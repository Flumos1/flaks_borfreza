export const config = {
  matcher: ["/", "/borfrezy/:path*", "/ua/:path*", "/ru/:path*"],
};

export default function middleware(request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang");
  if (lang !== "ua" && lang !== "ru") return;

  let changed = false;
  url.searchParams.delete("lang");

  if (url.pathname === "/") {
    url.pathname = `/${lang}/`;
    changed = true;
  } else if (url.pathname.startsWith("/borfrezy/")) {
    url.pathname = `/${lang}${url.pathname}`;
    changed = true;
  } else if (url.pathname.startsWith("/ua/") || url.pathname.startsWith("/ru/")) {
    changed = true;
  }

  if (!changed) return;
  return Response.redirect(url, 308);
}
