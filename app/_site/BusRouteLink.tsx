"use client";

const BUS_ROUTE_URL = "https://www.runvia.com.au";

// On Android, a link tapped inside an installed app or a small built-in viewer opens in a stripped-down
// window with no menu, so Runvia can't be installed from it. This asks the phone to open the address in
// the Chrome app itself instead. If Chrome isn't there it falls back to the normal address. Everywhere else
// (computers, iPhones) it is an ordinary link.
export default function BusRouteLink() {
  return (
    <a
      href={BUS_ROUTE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        if (/Android/i.test(navigator.userAgent)) {
          e.preventDefault();
          const fallback = encodeURIComponent(BUS_ROUTE_URL);
          window.location.href = `intent://www.runvia.com.au/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
        }
      }}
      className="block py-2 hover:text-white"
    >
      Runvia
    </a>
  );
}
