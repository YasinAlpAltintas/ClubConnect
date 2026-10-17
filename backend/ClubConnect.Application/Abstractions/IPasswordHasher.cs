namespace ClubConnect.Application.Abstractions;

/// <summary>
/// One-way password hashing and verification. Implementations must use
/// a modern, memory-hard algorithm (Argon2id) and store the cost/salt/params
/// inside the encoded string so verification is self-describing.
/// </summary>
public interface IPasswordHasher
{
    /// <summary>Hashes a plaintext password into a self-describing encoded string.</summary>
    string Hash(string password);

    /// <summary>Returns true when <paramref name="password"/> matches <paramref name="encodedHash"/>.</summary>
    bool Verify(string password, string encodedHash);
}
