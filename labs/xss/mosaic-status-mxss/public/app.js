/* Status page chrome. Exposes the build id so the incident timeline can
   bust its own cache after a deploy. */
window.__MOSAIC_BUILD = document.currentScript.dataset.build;

document.addEventListener("DOMContentLoaded", function () {
  var el = document.getElementById("build");
  if (el) el.textContent = "build " + window.__MOSAIC_BUILD;
});
