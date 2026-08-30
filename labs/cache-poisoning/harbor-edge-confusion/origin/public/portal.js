/* Portal chrome. Loaded from the request's own origin so white-label
   partner domains do not trip the browser's mixed-content rules. */
document.addEventListener("DOMContentLoaded", function () {
  var el = document.getElementById("year");
  if (el) el.textContent = String(new Date().getFullYear());
});
