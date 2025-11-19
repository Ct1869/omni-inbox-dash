import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { useTheme } from "next-themes";

interface EmailViewerProps {
  htmlContent?: string | null;
  textContent?: string | null;
  className?: string;
}

const EmailViewer = ({ htmlContent, textContent, className = "" }: EmailViewerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [renderError, setRenderError] = useState(false);
  const [showTextVersion, setShowTextVersion] = useState(false);

  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    setLoading(true);
    setRenderError(false);

    // Sanitize HTML first, THEN fix encoding issues
    let processedHtml = htmlContent || "";

    if (processedHtml) {
      // Configure DOMPurify with security settings that preserve email layout
      // SECURITY: Sanitize BEFORE applying any text replacements
      let cleanHtml = DOMPurify.sanitize(processedHtml, {
        ALLOWED_TAGS: [
          "div", "span", "p", "br", "strong", "b", "em", "i", "u", "a", "img",
          "table", "thead", "tbody", "tr", "th", "td", "h1", "h2", "h3", "h4",
          "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code", "hr", "center",
          "font", "small", "big", "sup", "sub"
        ],
        ALLOWED_ATTR: [
          "href", "src", "alt", "title", "width", "height",
          "class", "id", "align", "valign", "colspan", "rowspan",
          "style", "bgcolor", "color", "border", "cellpadding", "cellspacing",
          "size", "face", "target", "rel"
        ],
        // Explicitly forbid dangerous attributes that can execute scripts
        FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onmouseout", "onfocus", "onblur"],
        // Explicitly forbid dangerous tags
        FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "textarea", "select"],
        // Restrict URLs to safe protocols only (https, http, mailto)
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        // Allow data URIs for images (common in emails)
        ADD_URI_SAFE_ATTR: ["src"],
      });

      // Fix encoding issues AFTER sanitization to prevent injection
      // Apply character replacements on the already-sanitized HTML
      cleanHtml = cleanHtml
        .replace(/Â/g, " ")
        .replace(/â€™/g, "'")
        .replace(/â€œ/g, '"')
        .replace(/â€/g, '"')
        .replace(/â€"/g, "—")
        .replace(/â€"/g, "–")
        .replace(/Ã©/g, "é")
        .replace(/Ã¨/g, "è")
        .replace(/Ã /g, "à");

      // Decode HTML entities that may have been double-encoded
      // Create a temporary div to decode entities safely (already sanitized by DOMPurify)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanHtml;
      cleanHtml = tempDiv.innerHTML;

      // Determine theme colors
      const isDark = theme === "dark";
      const bgColor = isDark ? "#09090b" : "#ffffff";
      const textColor = isDark ? "#fafafa" : "#09090b";
      const linkColor = isDark ? "#60a5fa" : "#2563eb";

      // Build complete HTML document with CSS isolation and responsive styles
      const iframeContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * {
                box-sizing: border-box;
              }
              
              html, body {
                margin: 0;
                padding: 0;
                width: 100%;
                height: auto;
                overflow-x: hidden;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 14px;
                line-height: 1.6;
              }

              body {
                padding: 8px;
              }

              /* Reset and responsive images */
              img {
                max-width: 100% !important;
                height: auto !important;
                display: inline-block;
                border: 0;
              }

              /* Broken image fallback */
              img[src=""], img:not([src]), img[src*="cid:"] {
                display: inline-block;
                width: auto;
                max-width: 200px;
                height: auto;
                background: ${isDark ? "#27272a" : "#f4f4f5"};
                border: 1px dashed ${isDark ? "#52525b" : "#d4d4d8"};
                padding: 8px;
              }

              img[src=""]::after, img:not([src])::after, img[src*="cid:"]::after {
                content: "🖼️ Image";
                color: ${isDark ? "#a1a1aa" : "#71717a"};
                font-size: 12px;
              }

              /* Responsive tables - preserve email layout */
              table {
                border-collapse: collapse;
              }

              td, th {
                vertical-align: top;
              }

              /* Only make tables responsive on very small screens */
              @media (max-width: 480px) {
                table {
                  max-width: 100% !important;
                  display: block;
                  overflow-x: auto;
                }
              }

              /* Links */
              a {
                color: ${linkColor};
                text-decoration: underline;
                word-break: break-word;
              }

              a:hover {
                opacity: 0.8;
              }

              /* Text elements */
              p {
                margin: 0 0 1em 0;
              }

              pre {
                white-space: pre-wrap;
                word-wrap: break-word;
                background: ${isDark ? "#18181b" : "#f9fafb"};
                padding: 12px;
                border-radius: 4px;
                overflow-x: auto;
              }

              blockquote {
                margin: 0 0 1em 0;
                padding-left: 16px;
                border-left: 3px solid ${isDark ? "#52525b" : "#d4d4d8"};
                color: ${isDark ? "#d4d4d8" : "#52525b"};
              }

              /* Prevent horizontal overflow on mobile */
              @media (max-width: 640px) {
                body > * {
                  max-width: 100%;
                }
              }

              /* Handle long words/URLs */
              a, p, div, span {
                word-wrap: break-word;
                overflow-wrap: break-word;
              }
            </style>
          </head>
          <body>
            ${cleanHtml}
          </body>
        </html>
      `;

      iframeDoc.open();
      iframeDoc.write(iframeContent);
      iframeDoc.close();

      // Check if HTML content is mostly empty (less than 50 characters of text)
      const textContent = iframeDoc.body.textContent || "";
      const trimmedText = textContent.trim();
      if (trimmedText.length < 50) {
        console.warn("HTML content appears empty or minimal, may need to show text fallback");
        // Don't set renderError here, let the user see what's there
      }

      // Force all links to open in new tab
      const links = iframeDoc.querySelectorAll("a");
      links.forEach((link) => {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
        // Prevent default and open in parent window (which opens new tab due to sandbox)
        link.addEventListener("click", (e) => {
          e.preventDefault();
          window.open(link.href, "_blank", "noopener,noreferrer");
        });
      });

      // Auto-resize iframe to content height
      const resizeIframe = () => {
        try {
          // Force a reflow to ensure content is laid out
          iframeDoc.body.offsetHeight;
          
          const body = iframeDoc.body;
          const html = iframeDoc.documentElement;
          
          // Get the actual scrollable content height
          const contentHeight = Math.max(
            body.scrollHeight,
            body.offsetHeight,
            html.clientHeight,
            html.scrollHeight,
            html.offsetHeight
          );
          
          // Ensure minimum height and add padding
          const finalHeight = Math.max(contentHeight, 100) + 32;
          
          console.log("Resizing iframe:", {
            bodyScrollHeight: body.scrollHeight,
            bodyOffsetHeight: body.offsetHeight,
            htmlScrollHeight: html.scrollHeight,
            contentHeight,
            finalHeight
          });
          
          iframe.style.height = `${finalHeight}px`;
          setLoading(false);
        } catch (e) {
          console.error("Failed to resize iframe:", e);
          iframe.style.height = "500px"; // Fallback height
          setLoading(false);
        }
      };

      // Wait for images to load before resizing
      const images = iframeDoc.querySelectorAll("img");
      let loadedImages = 0;
      const totalImages = images.length;

      if (totalImages === 0) {
        // Multiple resize attempts to ensure accurate measurement
        setTimeout(resizeIframe, 50);
        setTimeout(resizeIframe, 150);
        setTimeout(resizeIframe, 300);
      } else {
        images.forEach((img) => {
          const handleImageLoad = () => {
            loadedImages++;
            if (loadedImages === totalImages) {
              // Multiple resize attempts after images load
              setTimeout(resizeIframe, 50);
              setTimeout(resizeIframe, 150);
              setTimeout(resizeIframe, 300);
            }
          };

          if (img.complete) {
            handleImageLoad();
          } else {
            img.addEventListener("load", handleImageLoad);
            img.addEventListener("error", handleImageLoad); // Count errors too
          }
        });

        // Fallback if images take too long
        setTimeout(() => {
          if (loadedImages < totalImages) {
            resizeIframe();
          }
        }, 3000);
      }

      // Watch for content changes and resize
      const observer = new MutationObserver(() => {
        resizeIframe();
      });

      observer.observe(iframeDoc.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      return () => observer.disconnect();
    } else {
      setLoading(false);
    }
  }, [htmlContent, theme]);

  if (!htmlContent && !textContent) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        No content available.
      </div>
    );
  }

  if (!htmlContent && textContent) {
    return (
      <pre className={`whitespace-pre-wrap text-sm text-foreground font-sans break-words ${className}`}>
        {textContent}
      </pre>
    );
  }

  // Show text version if user toggled or if HTML failed
  if ((showTextVersion || renderError) && textContent) {
    return (
      <div className={`${className}`}>
        {htmlContent && (
          <button
            onClick={() => setShowTextVersion(false)}
            className="mb-4 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
          >
            ← Show HTML version
          </button>
        )}
        <pre className="whitespace-pre-wrap text-sm text-foreground font-sans break-words">
          {textContent}
        </pre>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${className}`}>
      {loading && (
        <div className="text-sm text-muted-foreground mb-4">Loading message…</div>
      )}
      {!loading && textContent && (
        <button
          onClick={() => setShowTextVersion(true)}
          className="mb-2 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
        >
          Show text version
        </button>
      )}
      <iframe
        ref={iframeRef}
        title="Email content"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="w-full border-0 overflow-hidden"
        style={{
          minHeight: "200px",
          display: loading ? "none" : "block",
        }}
      />
    </div>
  );
};

export default EmailViewer;
