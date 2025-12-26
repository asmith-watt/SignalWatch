import type { GeneratedArticle } from "./article-generator";
import type { Signal, Company } from "@shared/schema";

export interface WordPressCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface WordPressPublishResult {
  success: boolean;
  postId?: number;
  postUrl?: string;
  error?: string;
}

export async function publishToWordPress(
  article: GeneratedArticle,
  signal: Signal,
  company: Company | null,
  credentials: WordPressCredentials,
  status: "draft" | "publish" = "draft"
): Promise<WordPressPublishResult> {
  const { siteUrl, username, applicationPassword } = credentials;
  
  const cleanSiteUrl = siteUrl.replace(/\/$/, "");
  const apiUrl = `${cleanSiteUrl}/wp-json/wp/v2/posts`;
  
  const authString = Buffer.from(`${username}:${applicationPassword}`).toString("base64");
  
  const sourceHtml = signal.sourceUrl
    ? `<a href="${signal.sourceUrl}" target="_blank" rel="noopener noreferrer">${signal.sourceName || "Original Source"}</a>`
    : signal.sourceName || "Industry sources";

  const postContent = `${article.body}

<h3>Key Takeaways</h3>
<ul>
${article.keyTakeaways.map(t => `<li>${t}</li>`).join("\n")}
</ul>

<p><em>Source: ${sourceHtml}</em></p>`;

  const postData = {
    title: article.headline,
    content: postContent,
    excerpt: article.seoDescription,
    status: status,
    meta: {
      signal_id: signal.id.toString(),
      source_url: signal.sourceUrl || "",
    },
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authString}`,
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `WordPress API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      return { success: false, error: errorMessage };
    }

    const result = await response.json();
    
    return {
      success: true,
      postId: result.id,
      postUrl: result.link,
    };
  } catch (error) {
    console.error("WordPress publish error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to WordPress",
    };
  }
}

export async function testWordPressConnection(
  credentials: WordPressCredentials
): Promise<{ success: boolean; error?: string; siteName?: string }> {
  const { siteUrl, username, applicationPassword } = credentials;
  
  const cleanSiteUrl = siteUrl.replace(/\/$/, "");
  const apiUrl = `${cleanSiteUrl}/wp-json/wp/v2/users/me`;
  
  const authString = Buffer.from(`${username}:${applicationPassword}`).toString("base64");

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${authString}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: "Invalid username or application password" };
      }
      return { success: false, error: `Connection failed: ${response.status}` };
    }

    const siteResponse = await fetch(`${cleanSiteUrl}/wp-json`);
    const siteInfo = await siteResponse.json();

    return {
      success: true,
      siteName: siteInfo.name || "WordPress Site",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to WordPress",
    };
  }
}
