// "Install app" button for the title screen.
// Chrome, Edge and Android hand us an install prompt we can trigger from a button.
// iPhone/iPad and Mac Safari never do, so the button shows the steps for those instead.
// Firefox on desktop can't install web apps, so the button stays hidden there.

const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); // iPadOS reports as a Mac
const isMacSafari = !isIOS && /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua);
const installed = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone), (display-mode: minimal-ui)').matches || navigator.standalone === true;

export function mountInstallButton(button, help) {
  let deferred = null;
  const show = on => { button.hidden = !on || installed(); };

  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; show(true); });
  addEventListener('appinstalled', () => { deferred = null; show(false); help.hidden = true; });

  if (isIOS) {
    help.innerHTML = 'Tap the <b>Share</b> button <span aria-hidden="true">(the square with an arrow)</span>, then <b>Add to Home Screen</b>. VibeGolf will open full screen from your home screen.';
    show(true);
  } else if (isMacSafari) {
    help.innerHTML = 'In the menu bar choose <b>File → Add to Dock</b>. VibeGolf will open in its own window.';
    show(true);
  }

  button.addEventListener('click', async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') show(false);
      deferred = null;
      return;
    }
    help.hidden = !help.hidden;
  });
}
