(() => {
  const API_ROOT =
    window.PUBLIC_API || `${window.location.protocol}//${window.location.host}`;

  const buildUrl = (path) => {
    if (/^https?:\/\//i.test(path)) return path;
    if (!path.startsWith("/")) return `${API_ROOT}/${path}`;
    return `${API_ROOT}${path}`;
  };

  const parseJson = async (response) => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        return await response.json();
      } catch (error) {
        return { ok: false, error: "invalid_json" };
      }
    }

    return { ok: false, error: response.statusText || `HTTP ${response.status}` };
  };

  const request = async (path, options = {}) => {
    const { body, headers, credentials = "include", method } = options;
    const init = {
      method: method || (body ? "POST" : "GET"),
      credentials,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
    };

    if (body instanceof FormData) {
      init.body = body;
      delete init.headers["Content-Type"];
    } else if (body !== undefined) {
      init.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const response = await fetch(buildUrl(path), init);
    return parseJson(response);
  };

  window.PublicApp = {
    API: API_ROOT,
    request,
    buildUrl,
  };
})();
