using System.Security.Cryptography;
using Konscious.Security.Cryptography;
using ClubConnect.Application.Abstractions;

namespace ClubConnect.Infrastructure.Security;

/// <summary>
/// Argon2id implementation of <see cref="IPasswordHasher"/> that produces a
/// PHC-format string ($argon2id$v=19$m={mem},t={t},p={p}$b64(salt)$b64(hash)).
/// Defaults to OWASP-minimum parameters (19456 KiB, 2 iterations, parallelism 1).
/// </summary>
public class Argon2PasswordHasher : IPasswordHasher
{
    public const int DefaultMemorySize = 19_456;
    public const int DefaultIterations = 2;
    public const int DefaultDegreeOfParallelism = 1;
    private const int SaltLength = 16;
    private const int HashLength = 32;
    private const string PhcPrefix = "$argon2id";
    private const string PhcVersion = "v=19";

    public Argon2PasswordHasher() : this(DefaultMemorySize, DefaultIterations, DefaultDegreeOfParallelism) { }

    public Argon2PasswordHasher(int memorySizeKiB, int iterations, int degreeOfParallelism)
    {
        ArgumentGuard.ThrowIfOutOfRange(nameof(memorySizeKiB), memorySizeKiB, 1, int.MaxValue);
        ArgumentGuard.ThrowIfOutOfRange(nameof(iterations), iterations, 1, int.MaxValue);
        ArgumentGuard.ThrowIfOutOfRange(nameof(degreeOfParallelism), degreeOfParallelism, 1, 255);

        MemorySizeKiB = memorySizeKiB;
        Iterations = iterations;
        DegreeOfParallelism = degreeOfParallelism;
    }

    public int MemorySizeKiB { get; }
    public int Iterations { get; }
    public int DegreeOfParallelism { get; }

    public string Hash(string password)
    {
        ArgumentException.ThrowIfNullOrEmpty(password);

        var salt = RandomNumberGenerator.GetBytes(SaltLength);
        var hash = Derive(password, salt, MemorySizeKiB, Iterations, DegreeOfParallelism);

        return $"$argon2id$v=19$m={MemorySizeKiB},t={Iterations},p={DegreeOfParallelism}${ToBase64NoPadding(salt)}${ToBase64NoPadding(hash)}";
    }

    public bool Verify(string password, string encodedHash)
    {
        if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(encodedHash))
            return false;

        if (!TryParsePhcString(encodedHash, out var salt, out var hash,
            out var memorySize, out var iterations, out var parallelism))
            return false;

        var computed = Derive(password, salt, memorySize, iterations, parallelism);
        return CryptographicOperations.FixedTimeEquals(computed, hash);
    }

    private static byte[] Derive(string password, byte[] salt, int memorySizeKiB, int iterations, int parallelism)
    {
        using var kdf = new Argon2id(System.Text.Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            Iterations = iterations,
            MemorySize = memorySizeKiB,
            DegreeOfParallelism = parallelism
        };
        return kdf.GetBytes(HashLength);
    }

    private static bool TryParsePhcString(
        string encodedHash,
        out byte[] salt,
        out byte[] hash,
        out int memorySize,
        out int iterations,
        out int parallelism)
    {
        salt = Array.Empty<byte>();
        hash = Array.Empty<byte>();
        memorySize = 0;
        iterations = 0;
        parallelism = 0;

        if (!encodedHash.StartsWith(PhcPrefix, StringComparison.Ordinal))
            return false;

        // Expected layout:  $argon2id$v=19$m={mem},t={t},p={p}$b64salt$b64hash
        // Splitting on '$' yields: ["", "argon2id", "v=19", "m=...,...", "salt", "hash"]
        var parts = encodedHash.Split('$');
        if (parts.Length != 6 || parts[0] != "" || parts[1] != "argon2id" || parts[2] != PhcVersion)
            return false;

        if (!TryParseParams(parts[3], out memorySize, out iterations, out parallelism))
            return false;
        if (memorySize < 1 || iterations < 1 || parallelism < 1)
            return false;

        if (!TryFromBase64NoPadding(parts[4], out salt) || salt.Length < 1)
            return false;
        if (!TryFromBase64NoPadding(parts[5], out hash) || hash.Length < 1)
            return false;

        return true;
    }

    private static bool TryParseParams(string paramsPart, out int memorySize, out int iterations, out int parallelism)
    {
        memorySize = 0;
        iterations = 0;
        parallelism = 0;

        foreach (var field in paramsPart.Split(','))
        {
            var idx = field.IndexOf('=');
            if (idx <= 0 || idx == field.Length - 1)
                return false;

            var key = field[..idx];
            if (!int.TryParse(field[(idx + 1)..], out var value))
                return false;

            switch (key)
            {
                case "m" when memorySize == 0: memorySize = value; break;
                case "t" when iterations == 0: iterations = value; break;
                case "p" when parallelism == 0: parallelism = value; break;
                default: return false;
            }
        }

        return true;
    }

    private static string ToBase64NoPadding(byte[] bytes)
        => Convert.ToBase64String(bytes).TrimEnd('=');

    private static bool TryFromBase64NoPadding(string s, out byte[] bytes)
    {
        bytes = Array.Empty<byte>();
        if (string.IsNullOrEmpty(s))
            return false;

        var padded = s.PadRight(s.Length + ((4 - s.Length % 4) % 4), '=');
        try
        {
            bytes = Convert.FromBase64String(padded);
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}

internal static class ArgumentGuard
{
    public static void ThrowIfOutOfRange(string paramName, int value, int min, int max)
    {
        if (value < min || value > max)
            throw new ArgumentOutOfRangeException(paramName, value,
                $"Value {value} is out of the inclusive range [{min}, {max}].");
    }
}
