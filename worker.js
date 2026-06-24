export default {
  async fetch(request) {
    const target = "https://catclass.net/";
    const url = new URL(request.url);
    const path = url.pathname + url.search;
    const targetUrl = new URL(path, target);

    const headers = new Headers(request.headers);
    headers.delete("cf-connecting-ip");
    headers.delete("x-forwarded-for");
    headers.set("referer", target);
    headers.set("origin", target);

    const init = {
      method: request.method,
      headers: headers,
      redirect: "follow",
      body: request.body,
    };

    let response = await fetch(targetUrl, init);

    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    newHeaders.set("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS");
    newHeaders.delete("x-frame-options");
    newHeaders.delete("content-security-policy");
    newHeaders.set("x-frame-options", "ALLOW");
    newHeaders.set("cache-control", "no-store, no-cache");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }
};
