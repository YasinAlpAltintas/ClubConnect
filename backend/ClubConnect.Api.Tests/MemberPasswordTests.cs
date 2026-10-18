using ClubConnect.Application.Members;
using Xunit;

namespace ClubConnect.Api.Tests;

public class MemberPasswordTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Validate_NullOrEmpty_ReturnsRequiredMessage(string? input)
    {
        var error = MemberPassword.Validate(input);

        Assert.Equal("Password is required.", error);
    }

    [Theory]
    [InlineData("       ")]        // 7 spaces — not empty, too short
    public void Validate_WhitespaceOnly_ReturnsLengthMessage(string input)
    {
        var error = MemberPassword.Validate(input);

        Assert.Equal("Password must be at least 8 characters long.", error);
    }

    [Theory]
    [InlineData("a1")]
    [InlineData("abc1234")]        // 7 chars — too short
    public void Validate_TooShort_ReturnsLengthMessage(string input)
    {
        var error = MemberPassword.Validate(input);

        Assert.Equal("Password must be at least 8 characters long.", error);
    }

    [Theory]
    [InlineData("onlyletters")]
    [InlineData("aaaaaaaa")]
    public void Validate_NoDigits_ReturnsDigitMessage(string input)
    {
        var error = MemberPassword.Validate(input);

        Assert.Equal("Password must contain at least one digit.", error);
    }

    [Theory]
    [InlineData("a1b2c3d4")]       // letters + digits, len 8
    [InlineData("abcdef12")]       // 6 letters, 2 digits, len 8
    [InlineData("1234567a")]       // one letter, len 8
    [InlineData("a1234567")]       // one letter, len 8
    [InlineData("Password1")]      // letters + 1 digit, len 9
    [InlineData("1Password")]      // 1 digit + letters, len 9
    public void Validate_Valid_ReturnsNull(string input)
    {
        Assert.Null(MemberPassword.Validate(input));
    }

    [Theory]
    [InlineData("12345678")]        // 8 digits, no letter → invalid
    [InlineData("1234567890123")]
    public void Validate_AllDigits_ReturnsLetterMessage(string input)
    {
        var error = MemberPassword.Validate(input);

        Assert.Equal("Password must contain at least one letter.", error);
    }

    [Fact]
    public void MinimumLength_Constant_IsEight()
    {
        Assert.Equal(8, MemberPassword.MinimumLength);
    }
}
