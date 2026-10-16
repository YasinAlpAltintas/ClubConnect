using ClubConnect.Application.Members;
using Xunit;

namespace ClubConnect.Api.Tests;

/// <summary>
/// <see cref="MemberEmail.Canonicalize"/> returns the canonical string for a
/// well-formed address and <c>null</c> for anything invalid. These tests pin
/// the contract the frontend Zod schema mirrors.
/// </summary>
public class MemberEmailTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("@example.com")]
    [InlineData("user@")]
    [InlineData("not-an-email")]
    [InlineData("user@@example.com")]
    [InlineData("user name@example.com")]
    [InlineData("user@example")]
    [InlineData("user@.example.com")]
    [InlineData("user@example..com")]
    [InlineData("user@10.0.0.1")]
    [InlineData(".hidden@example.com")]
    [InlineData("hidden.@example.com")]
    public void Canonicalize_Invalid_ReturnsNull(string? input)
    {
        Assert.Null(MemberEmail.Canonicalize(input));
    }

    [Fact]
    public void Canonicalize_Valid_LowercasesAndTrims()
    {
        Assert.Equal("user@example.com", MemberEmail.Canonicalize("  User@Example.COM  "));
    }

    [Fact]
    public void Canonicalize_MixedCase_ReturnsCanonical()
    {
        Assert.Equal("a.b+tag@example.co.uk", MemberEmail.Canonicalize("A.b+tag@example.co.uk"));
    }

    [Fact]
    public void Canonicalize_AcceptsNumericLocal()
    {
        Assert.Equal("12345@example.com", MemberEmail.Canonicalize("12345@example.com"));
    }

    [Fact]
    public void Canonicalize_AcceptsTwoLetterTld()
    {
        Assert.Equal("user@ex.cm", MemberEmail.Canonicalize("user@EX.CM"));
    }

    [Fact]
    public void Canonicalize_RejectsLocalPartLongerThan64()
    {
        var longLocal = new string('a', 65);
        Assert.Null(MemberEmail.Canonicalize($"{longLocal}@example.com"));
    }

    [Fact]
    public void Canonicalize_AcceptsLocalPartExactly64()
    {
        var local = new string('a', 64);
        Assert.Equal($"{local}@example.com", MemberEmail.Canonicalize($"{local}@example.com"));
    }
}
