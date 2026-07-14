const LONG_LIVED_ASSET = /\.(?:css|js|woff2|png|ico|webp|avif)$/i;

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const assetUrl = new URL(url);

        if (url.pathname === "/") {
            assetUrl.pathname = "/index.html";
        }

        const response = await env.ASSETS.fetch(new Request(assetUrl, request));

        if (!response.ok) return response;

        const headers = new Headers(response.headers);
        if (url.pathname === "/" || url.pathname.endsWith(".html")) {
            headers.set("cache-control", "public, max-age=600, stale-while-revalidate=86400");
        } else if (LONG_LIVED_ASSET.test(url.pathname)) {
            headers.set("cache-control", "public, max-age=31536000, immutable");
        }

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
        });
    }
};
