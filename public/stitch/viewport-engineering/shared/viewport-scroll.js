(function () {
  function getHeroBlueprintGrid() {
    var first = document.querySelector("main > section:first-of-type");
    if (!first) return null;
    var inner = first.querySelector(".blueprint-grid");
    if (inner) return inner;
    if (first.classList.contains("blueprint-grid")) return first;
    return null;
  }

  var nav = document.querySelector("body > nav");
  if (nav) {
    var threshold = 8;

    function onScroll() {
      var y = window.scrollY || document.documentElement.scrollTop;
      nav.classList.toggle("vp-nav--elevated", y > threshold);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  var grid = getHeroBlueprintGrid();
  if (!grid) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  grid.classList.add("vp-blueprint-grid--pending");

  var io = new IntersectionObserver(
    function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        grid.classList.add("vp-blueprint-grid--revealed");
        io.unobserve(grid);
        return;
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );

  io.observe(grid);
})();
