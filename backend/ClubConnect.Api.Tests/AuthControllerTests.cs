using ClubConnect.Api.Controllers;
using ClubConnect.Application.Abstractions;
using ClubConnect.Application.Members;
using ClubConnect.Domain.Abstractions;
using ClubConnect.Domain.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ClubConnect.Api.Tests;

public class AuthControllerTests
{
    private readonly Mock<IMemberRepository> _members = new();
    private readonly Mock<IPasswordHasher> _hasher = new();

    private AuthController CreateController()
    {
        var registerUseCase = new RegisterMemberUseCase(_members.Object, _hasher.Object);
        var loginUseCase = new LoginMemberUseCase(_members.Object, _hasher.Object);
        return new AuthController(registerUseCase, loginUseCase);
    }

    [Fact]
    public async Task Register_ValidPayload_ReturnsCreated()
    {
        var controller = CreateController();
        _members.Setup(m => m.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);
        _hasher.Setup(h => h.Hash(It.IsAny<string>())).Returns("hashed_secret");
        _members.Setup(m => m.AddAsync(It.IsAny<Member>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Member
            {
                Id = Guid.NewGuid(),
                Email = "ada@example.com",
                PasswordHash = "hashed_secret",
                CreatedAtUtc = DateTimeOffset.UtcNow,
            });

        var request = new AuthController.RegisterRequest("ada@example.com", "Passw0rd1!", "Ada Lovelace");
        var result = await controller.Register(request, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status201Created, objectResult.StatusCode);
        var response = Assert.IsType<AuthController.RegisterResponse>(objectResult.Value);
        Assert.Equal("ada@example.com", response.Email);
    }

    [Fact]
    public async Task Register_InvalidPayload_ReturnsBadRequest()
    {
        var controller = CreateController();

        var request = new AuthController.RegisterRequest("invalid-email", "short");
        var result = await controller.Register(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Register_ExistingEmail_ReturnsConflict()
    {
        var controller = CreateController();
        _members.Setup(m => m.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Member
            {
                Id = Guid.NewGuid(),
                Email = "ada@example.com",
                PasswordHash = "hashed",
                CreatedAtUtc = DateTimeOffset.UtcNow,
            });

        var request = new AuthController.RegisterRequest("ada@example.com", "Passw0rd1!");
        var result = await controller.Register(request, CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task Register_WhenDbUpdateExceptionWithDuplicateKeyThrown_ReturnsConflict()
    {
        var controller = CreateController();
        _members.Setup(m => m.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);
        _hasher.Setup(h => h.Hash(It.IsAny<string>())).Returns("hashed_secret");
        _members.Setup(m => m.AddAsync(It.IsAny<Member>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DbUpdateException("duplicate key value violates unique constraint", new Exception("23505 duplicate key")));

        var request = new AuthController.RegisterRequest("ada@example.com", "Passw0rd1!");
        var result = await controller.Register(request, CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task Register_WhenDbUpdateExceptionWithoutDuplicateKeyThrown_Rethrows()
    {
        var controller = CreateController();
        _members.Setup(m => m.FindByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);
        _hasher.Setup(h => h.Hash(It.IsAny<string>())).Returns("hashed_secret");
        _members.Setup(m => m.AddAsync(It.IsAny<Member>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new DbUpdateException("unrelated database failure"));

        var request = new AuthController.RegisterRequest("ada@example.com", "Passw0rd1!");

        await Assert.ThrowsAsync<DbUpdateException>(() => controller.Register(request, CancellationToken.None));
    }

    [Fact]
    public async Task Login_ValidCredentials_ReturnsOkWithMember()
    {
        var controller = CreateController();
        var memberId = Guid.NewGuid();
        _members.Setup(m => m.FindByEmailAsync("ada@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Member
            {
                Id = memberId,
                Email = "ada@example.com",
                DisplayName = "Ada Lovelace",
                PasswordHash = "valid_argon2_hash"
            });
        _hasher.Setup(h => h.Verify("Passw0rd1!", "valid_argon2_hash")).Returns(true);

        var request = new AuthController.LoginRequest("ada@example.com", "Passw0rd1!");
        var result = await controller.Login(request, CancellationToken.None);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthController.LoginResponse>(okResult.Value);
        Assert.Equal(memberId, response.MemberId);
        Assert.Equal("ada@example.com", response.Email);
        Assert.Equal("Ada Lovelace", response.DisplayName);
        Assert.False(string.IsNullOrWhiteSpace(response.Token));
    }

    [Fact]
    public async Task Login_InvalidInput_ReturnsBadRequest()
    {
        var controller = CreateController();

        var request = new AuthController.LoginRequest("not-an-email", "");
        var result = await controller.Login(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Login_UnknownMember_ReturnsUnauthorized()
    {
        var controller = CreateController();
        _members.Setup(m => m.FindByEmailAsync("unknown@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);

        var request = new AuthController.LoginRequest("unknown@example.com", "Passw0rd1!");
        var result = await controller.Login(request, CancellationToken.None);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task Login_WrongPassword_ReturnsUnauthorized()
    {
        var controller = CreateController();
        _members.Setup(m => m.FindByEmailAsync("ada@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Member
            {
                Id = Guid.NewGuid(),
                Email = "ada@example.com",
                PasswordHash = "valid_argon2_hash"
            });
        _hasher.Setup(h => h.Verify("WrongPassword!", "valid_argon2_hash")).Returns(false);

        var request = new AuthController.LoginRequest("ada@example.com", "WrongPassword!");
        var result = await controller.Login(request, CancellationToken.None);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public void GetProfile_MissingAuthHeader_ReturnsUnauthorized()
    {
        var controller = CreateController();
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };

        var result = controller.GetProfile();
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public void GetProfile_ValidToken_ReturnsOkWithProfile()
    {
        var jwtService = new Infrastructure.Security.JwtTokenService(Infrastructure.Security.JwtTokenService.DefaultSecretKey);
        var memberId = Guid.NewGuid();
        var member = new Member
        {
            Id = memberId,
            Email = "ada@example.com",
            DisplayName = "Ada Lovelace",
            PasswordHash = "hash",
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        var token = jwtService.GenerateToken(member);

        var registerUseCase = new RegisterMemberUseCase(_members.Object, _hasher.Object);
        var loginUseCase = new LoginMemberUseCase(_members.Object, _hasher.Object);
        var controller = new AuthController(registerUseCase, loginUseCase, jwtService, _members.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        controller.Request.Headers.Authorization = $"Bearer {token}";

        var result = controller.GetProfile();
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthController.LoginResponse>(okResult.Value);
        Assert.Equal(memberId, response.MemberId);
        Assert.Equal("ada@example.com", response.Email);
    }

    [Fact]
    public void GetProfile_ExpiredToken_ReturnsUnauthorizedWithTokenExpired()
    {
        var jwtService = new Infrastructure.Security.JwtTokenService(Infrastructure.Security.JwtTokenService.DefaultSecretKey);
        var member = new Member
        {
            Id = Guid.NewGuid(),
            Email = "ada@example.com",
            DisplayName = "Ada Lovelace",
            PasswordHash = "hash",
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        var token = jwtService.GenerateToken(member, TimeSpan.FromSeconds(-10));

        var registerUseCase = new RegisterMemberUseCase(_members.Object, _hasher.Object);
        var loginUseCase = new LoginMemberUseCase(_members.Object, _hasher.Object);
        var controller = new AuthController(registerUseCase, loginUseCase, jwtService, _members.Object);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        controller.Request.Headers.Authorization = $"Bearer {token}";

        var result = controller.GetProfile();
        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task CheckEmail_EmptyEmail_ReturnsBadRequest()
    {
        var controller = CreateController();
        var result = await controller.CheckEmail("", CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CheckEmail_InvalidFormat_ReturnsBadRequest()
    {
        var controller = CreateController();
        var result = await controller.CheckEmail("not-an-email", CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task CheckEmail_ExistingEmail_ReturnsOkWithExistsTrue()
    {
        var registerUseCase = new RegisterMemberUseCase(_members.Object, _hasher.Object);
        var loginUseCase = new LoginMemberUseCase(_members.Object, _hasher.Object);
        var controller = new AuthController(registerUseCase, loginUseCase, null, _members.Object);

        _members.Setup(m => m.FindByEmailAsync("exists@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Member
            {
                Id = Guid.NewGuid(),
                Email = "exists@example.com",
                PasswordHash = "hash",
                CreatedAtUtc = DateTimeOffset.UtcNow
            });

        var result = await controller.CheckEmail("exists@example.com", CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthController.CheckEmailResponse>(okResult.Value);
        Assert.True(response.Exists);
        Assert.Equal("exists@example.com", response.Email);
    }

    [Fact]
    public async Task CheckEmail_NonExistingEmail_ReturnsOkWithExistsFalse()
    {
        var registerUseCase = new RegisterMemberUseCase(_members.Object, _hasher.Object);
        var loginUseCase = new LoginMemberUseCase(_members.Object, _hasher.Object);
        var controller = new AuthController(registerUseCase, loginUseCase, null, _members.Object);

        _members.Setup(m => m.FindByEmailAsync("notfound@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Member?)null);

        var result = await controller.CheckEmail("notfound@example.com", CancellationToken.None);
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<AuthController.CheckEmailResponse>(okResult.Value);
        Assert.False(response.Exists);
    }

    [Fact]
    public void Logout_Returns200Ok()
    {
        var controller = CreateController();
        var result = controller.Logout();

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, okResult.StatusCode);
    }
}

