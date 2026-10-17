using ClubConnect.Infrastructure.Security;
using Xunit;

namespace ClubConnect.Api.Tests;

public class Argon2PasswordHasherTests
{
    [Fact]
    public void Hash_ProducesWellFormedPhcString()
    {
        var hasher = new Argon2PasswordHasher();
        var encoded = hasher.Hash("correct horse battery staple");

        Assert.StartsWith("$argon2id$v=19$m=19456,t=2,p=1$", encoded);
        var segments = encoded.Split('$');
        Assert.Equal(6, segments.Length);
        Assert.Equal("", segments[0]);
        Assert.Equal("argon2id", segments[1]);
        Assert.Equal("v=19", segments[2]);
        Assert.StartsWith("m=19456,t=2,p=1", segments[3]);
        Assert.False(string.IsNullOrWhiteSpace(segments[4]));
        Assert.False(string.IsNullOrWhiteSpace(segments[5]));
    }

    [Fact]
    public void Hash_TwiceForSamePassword_ProducesDifferentSalts()
    {
        var hasher = new Argon2PasswordHasher();
        var a = hasher.Hash("same-password");
        var b = hasher.Hash("same-password");

        Assert.NotEqual(a, b);
    }

    [Fact]
    public void Verify_CorrectPassword_ReturnsTrue()
    {
        var hasher = new Argon2PasswordHasher();
        var encoded = hasher.Hash("correct horse battery staple");

        Assert.True(hasher.Verify("correct horse battery staple", encoded));
    }

    [Fact]
    public void Verify_WrongPassword_ReturnsFalse()
    {
        var hasher = new Argon2PasswordHasher();
        var encoded = hasher.Hash("correct horse battery staple");

        Assert.False(hasher.Verify("not the right one", encoded));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Verify_EmptyOrNullOrEmptyHash_ReturnsFalse(string? password)
    {
        var hasher = new Argon2PasswordHasher();

        Assert.False(hasher.Verify(password, null!));
        Assert.False(hasher.Verify(password, ""));
        Assert.False(hasher.Verify("something", null!));
    }

    [Theory]
    [InlineData("not-a-phc-string")]
    [InlineData("$argon2$v=19$m=1,t=1,p=1$abc$def")]
    [InlineData("$argon2id$v=18$m=1,t=1,p=1$abc$def")]
    [InlineData("$argon2id$v=19$abc")]
    [InlineData("$argon2id$v=19$m=1,t=1,p=1$abc")]
    public void Verify_MalformedPhcString_ReturnsFalse(string encoded)
    {
        var hasher = new Argon2PasswordHasher();

        Assert.False(hasher.Verify("password", encoded));
    }

    [Fact]
    public void Hash_EmptyPassword_Throws()
    {
        var hasher = new Argon2PasswordHasher();

        Assert.Throws<ArgumentException>(() => hasher.Hash(""));
    }

    [Fact]
    public void Hash_NullPassword_Throws()
    {
        var hasher = new Argon2PasswordHasher();

        Assert.ThrowsAny<ArgumentException>(() => hasher.Hash(null!));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Constructor_MemorySizeOutOfRange_Throws(int memorySizeKiB)
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => new Argon2PasswordHasher(memorySizeKiB, 2, 1));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Constructor_IterationsOutOfRange_Throws(int iterations)
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => new Argon2PasswordHasher(19_456, iterations, 1));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(256)]
    public void Constructor_ParallelismOutOfRange_Throws(int degreeOfParallelism)
    {
        Assert.Throws<ArgumentOutOfRangeException>(
            () => new Argon2PasswordHasher(19_456, 2, degreeOfParallelism));
    }

    [Fact]
    public void ExposedParameters_MatchOWaspDefaults()
    {
        var hasher = new Argon2PasswordHasher();

        Assert.Equal(19_456, hasher.MemorySizeKiB);
        Assert.Equal(2, hasher.Iterations);
        Assert.Equal(1, hasher.DegreeOfParallelism);
    }
}
