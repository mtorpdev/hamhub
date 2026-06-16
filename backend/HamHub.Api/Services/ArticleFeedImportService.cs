using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using HamHub.Domain.Entities;
using HamHub.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HamHub.Api.Services;

public class ArticleFeedImportService
{
    private static readonly ArticleFeedSource[] Sources =
    [
        new("AMSAT", "https://www.amsat.org", "https://www.amsat.org/feed/", "Satellitter"),
        new("RSGB", "https://rsgb.org/main", "https://rsgb.org/main/feed/", "Nyheder"),
        new("Amateur Radio Newsline", "https://www.arnewsline.org", "https://www.arnewsline.org/?format=rss", "Nyheder"),
        new("This Week in Amateur Radio", "https://twiar.net", "https://twiar.net/feed/", "Nyheder")
    ];

    private static readonly string[] DemoArticleSlugs =
    [
        "velkommen-til-hamhub",
        "kom-i-gang-med-ft8",
        "din-foerste-hf-antenne",
        "forstaa-sdr",
        "dansk-amatørradiolovgivning",
        "dansk-amatoerradiolovgivning"
    ];

    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly HttpClient _httpClient;
    private readonly ILogger<ArticleFeedImportService> _logger;

    public ArticleFeedImportService(
        ApplicationDbContext context,
        UserManager<ApplicationUser> userManager,
        HttpClient httpClient,
        ILogger<ArticleFeedImportService> logger)
    {
        _context = context;
        _userManager = userManager;
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<ArticleFeedImportResult> ImportAsync(CancellationToken cancellationToken = default)
    {
        var imported = 0;
        var skipped = 0;
        var failedFeeds = 0;
        var now = DateTime.UtcNow;
        var admin = await EnsureImporterUserAsync(cancellationToken);

        foreach (var source in Sources)
        {
            try
            {
                var category = await EnsureCategoryAsync(source.CategoryName, cancellationToken);
                using var stream = await _httpClient.GetStreamAsync(source.FeedUrl, cancellationToken);
                var document = await XDocument.LoadAsync(stream, LoadOptions.None, cancellationToken);
                var items = document.Descendants("item").Take(12).ToList();

                foreach (var item in items)
                {
                    var title = CleanText(Value(item, "title"));
                    var link = CleanText(Value(item, "link"));
                    var guid = CleanText(Value(item, "guid"));

                    if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(link))
                    {
                        skipped++;
                        continue;
                    }

                    var duplicate = await _context.Articles.AnyAsync(a =>
                        (!string.IsNullOrWhiteSpace(guid) && a.FeedGuid == guid) ||
                        a.OriginalUrl == link,
                        cancellationToken);
                    if (duplicate)
                    {
                        skipped++;
                        continue;
                    }

                    var summary = BuildSummary(Value(item, "description"));
                    var publishedAt = ParseDate(Value(item, "pubDate")) ?? now;
                    var slug = await CreateUniqueSlugAsync(title, publishedAt, cancellationToken);

                    _context.Articles.Add(new Article
                    {
                        Title = title,
                        Slug = slug,
                        Summary = summary,
                        Content = BuildContent(summary, link, source.Name),
                        SourceName = source.Name,
                        SourceUrl = source.SiteUrl,
                        OriginalUrl = link,
                        FeedGuid = string.IsNullOrWhiteSpace(guid) ? link : guid,
                        ImportedAt = now,
                        CategoryId = category.Id,
                        AuthorId = admin.Id,
                        IsPublished = true,
                        PublishDate = publishedAt,
                        CreatedAt = now,
                        UpdatedAt = now
                    });
                    imported++;
                }

                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                failedFeeds++;
                _logger.LogWarning(ex, "Could not import article feed {FeedUrl}", source.FeedUrl);
            }
        }

        if (imported > 0)
        {
            await RemoveDemoArticlesAsync(cancellationToken);
        }

        return new ArticleFeedImportResult(imported, skipped, failedFeeds, now);
    }

    private async Task<ApplicationUser> EnsureImporterUserAsync(CancellationToken cancellationToken)
    {
        const string email = "news@hamhub.dk";
        var user = await _userManager.FindByEmailAsync(email);
        if (user != null) return user;

        user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            Callsign = "HAMHUB",
            FirstName = "HamHub",
            LastName = "Nyheder",
            Country = "Denmark"
        };

        var result = await _userManager.CreateAsync(user, $"News-{Guid.NewGuid():N}aA1!");
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(string.Join("; ", result.Errors.Select(e => e.Description)));
        }

        return user;
    }

    private async Task<ArticleCategory> EnsureCategoryAsync(string name, CancellationToken cancellationToken)
    {
        var slug = Slugify(name);
        var category = await _context.ArticleCategories.FirstOrDefaultAsync(c => c.Slug == slug, cancellationToken);
        if (category != null) return category;

        category = new ArticleCategory { Name = name, Slug = slug };
        _context.ArticleCategories.Add(category);
        await _context.SaveChangesAsync(cancellationToken);
        return category;
    }

    private async Task<string> CreateUniqueSlugAsync(string title, DateTime publishedAt, CancellationToken cancellationToken)
    {
        var baseSlug = Slugify(title);
        if (string.IsNullOrWhiteSpace(baseSlug)) baseSlug = $"nyhed-{publishedAt:yyyyMMdd}";

        var slug = baseSlug;
        var suffix = 2;
        while (await _context.Articles.AnyAsync(a => a.Slug == slug, cancellationToken))
        {
            slug = $"{baseSlug}-{suffix++}";
        }

        return slug;
    }

    private async Task RemoveDemoArticlesAsync(CancellationToken cancellationToken)
    {
        var demoArticles = await _context.Articles
            .Where(a => DemoArticleSlugs.Contains(a.Slug) && a.OriginalUrl == null)
            .ToListAsync(cancellationToken);

        if (demoArticles.Count == 0) return;

        _context.Articles.RemoveRange(demoArticles);
        await _context.SaveChangesAsync(cancellationToken);
    }

    private static string BuildContent(string? summary, string originalUrl, string sourceName)
    {
        var content = string.IsNullOrWhiteSpace(summary)
            ? "Denne nyhed er importeret fra et eksternt amatørradio-medie."
            : summary;

        return $"{content}\n\nLæs hele nyheden hos {sourceName}: {originalUrl}";
    }

    private static string? BuildSummary(string? html)
    {
        var text = CleanText(html);
        if (string.IsNullOrWhiteSpace(text)) return null;
        return text.Length <= 420 ? text : $"{text[..417].TrimEnd()}...";
    }

    private static string CleanText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;

        var withoutCdata = value.Replace("<![CDATA[", string.Empty).Replace("]]>", string.Empty);
        var withoutTags = Regex.Replace(withoutCdata, "<.*?>", " ");
        var decoded = WebUtility.HtmlDecode(withoutTags);
        return Regex.Replace(decoded, "\\s+", " ").Trim();
    }

    private static string? Value(XElement item, string localName)
    {
        return item.Elements().FirstOrDefault(e => e.Name.LocalName.Equals(localName, StringComparison.OrdinalIgnoreCase))?.Value;
    }

    private static DateTime? ParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        if (DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dto))
        {
            return dto.UtcDateTime;
        }

        return null;
    }

    private static string Slugify(string value)
    {
        var normalized = value.ToLowerInvariant()
            .Replace("æ", "ae")
            .Replace("ø", "oe")
            .Replace("å", "aa");
        var builder = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            builder.Append(char.IsLetterOrDigit(ch) ? ch : '-');
        }

        return Regex.Replace(builder.ToString(), "-+", "-").Trim('-');
    }

    private record ArticleFeedSource(string Name, string SiteUrl, string FeedUrl, string CategoryName);
}
