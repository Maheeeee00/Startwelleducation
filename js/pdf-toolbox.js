/*
 * PDF Toolbox — Start Well Education "SWE Tools"
 * Merge, add text, images to PDF, split/rotate/delete pages, page numbers, watermark.
 * Everything runs in the visitor's browser: files are never uploaded.
 * Uses pdf-lib (MIT) and pdf.js (Apache-2.0) from js/vendor/.
 */
  (function () {
    var L = window.PDFLib;
    var files = { merge: [], images: [], pages: [], numbers: [], watermark: [], text: [] };
    var multi = { merge: true, images: true };

    function $(sel) { return document.querySelector(sel); }
    function opt(name) { return $('[data-opt="' + name + '"]').value; }
    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }
    function size(n) {
      return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
    }
    function status(tool, msg, kind) {
      var el = $('[data-status="' + tool + '"]');
      el.textContent = msg || "";
      el.className = "status" + (kind ? " " + kind : "");
    }
    function baseName(f) { return f.name.replace(/\.[^.]+$/, ""); }

    function download(bytes, name) {
      var blob = new Blob([bytes], { type: "application/pdf" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }

    function loadPdf(file) {
      return file.arrayBuffer().then(function (buf) {
        return L.PDFDocument.load(buf).catch(function (e) {
          if (/encrypt/i.test(String(e && e.message))) {
            throw new Error("“" + file.name + "” is password-protected. Unlock it first, then try again.");
          }
          throw new Error("“" + file.name + "” could not be opened. Is it a real PDF file?");
        });
      });
    }

    // Parse "1-3, 5, 8-" into zero-based page indexes. Empty = all pages.
    function parseRange(text, count) {
      text = String(text || "").trim();
      if (!text) return Array.from({ length: count }, function (_, i) { return i; });
      var out = [];
      text.split(/[,;\s]+/).forEach(function (part) {
        if (!part) return;
        var m = part.match(/^(\d*)\s*-\s*(\d*)$/);
        var a, b;
        if (m) { a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : count; }
        else if (/^\d+$/.test(part)) { a = b = +part; }
        else throw new Error("I don't understand “" + part + "”. Use numbers like 1-3, 5.");
        if (a < 1 || b > count || a > b) throw new Error("Page " + part + " doesn't exist — this PDF has " + count + " page" + (count === 1 ? "" : "s") + ".");
        for (var i = a; i <= b; i++) if (out.indexOf(i - 1) === -1) out.push(i - 1);
      });
      if (!out.length) throw new Error("Type the page numbers, e.g. 1-3, 5.");
      return out;
    }

    // ---------- tabs ----------
    var tabs = document.querySelectorAll("[data-tab]");
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        tabs.forEach(function (x) { x.setAttribute("aria-pressed", String(x === t)); });
        document.querySelectorAll("[data-panel]").forEach(function (p) {
          p.hidden = p.getAttribute("data-panel") !== t.getAttribute("data-tab");
        });
      });
    });

    // ---------- file lists ----------
    function render(tool) {
      var list = $('[data-list="' + tool + '"]');
      var arr = files[tool];
      list.innerHTML = arr.map(function (f, i) {
        return '<li><span class="n">' + (i + 1) + '.</span><span class="name" title="' + esc(f.name) + '">' + esc(f.name) +
          '</span><span class="size">' + size(f.size) + "</span>" +
          (multi[tool] ? '<button type="button" data-move="-1" data-i="' + i + '" aria-label="Move up">↑</button>' +
                         '<button type="button" data-move="1" data-i="' + i + '" aria-label="Move down">↓</button>' : "") +
          '<button type="button" data-remove="' + i + '" aria-label="Remove">✕</button></li>';
      }).join("");
      var need = tool === "merge" ? 2 : 1;
      $('[data-run="' + tool + '"]').disabled = arr.length < need;
      if (tool === "merge" && arr.length === 1) status(tool, "Add at least one more PDF to merge.");
      else if (!arr.length) status(tool, "");
      if (tool === "text") { textEditor.load(arr[0]); return; }
      if (tool !== "merge" && tool !== "images" && arr.length) showPageCount(tool);
    }

    function showPageCount(tool) {
      loadPdf(files[tool][0]).then(function (doc) {
        var n = doc.getPageCount();
        status(tool, "This PDF has " + n + " page" + (n === 1 ? "" : "s") + ".");
      }).catch(function (e) { status(tool, e.message, "err"); });
    }

    function addFiles(tool, list) {
      var isImg = tool === "images";
      var picked = Array.from(list).filter(function (f) {
        return isImg ? /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name)
                     : f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      });
      if (!picked.length) { status(tool, isImg ? "Please choose image files." : "Please choose PDF files.", "err"); return; }
      files[tool] = multi[tool] ? files[tool].concat(picked) : [picked[0]];
      render(tool);
    }

    document.querySelectorAll("[data-input]").forEach(function (input) {
      var tool = input.getAttribute("data-input");
      var drop = input.closest(".drop");
      input.addEventListener("change", function () { addFiles(tool, input.files); input.value = ""; });
      ["dragenter", "dragover"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); });
      });
      ["dragleave", "drop"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); });
      });
      drop.addEventListener("drop", function (e) { addFiles(tool, e.dataTransfer.files); });
    });

    document.querySelectorAll("[data-list]").forEach(function (list) {
      var tool = list.getAttribute("data-list");
      list.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        var arr = files[tool];
        if (b.hasAttribute("data-remove")) {
          arr.splice(+b.getAttribute("data-remove"), 1);
        } else {
          var i = +b.getAttribute("data-i"), j = i + +b.getAttribute("data-move");
          if (j < 0 || j >= arr.length) return;
          var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        render(tool);
      });
    });

    // show "Turn by" only for rotate
    var actionSel = $('[data-opt="pageAction"]');
    function syncAction() {
      $('[data-show="rotate"]').hidden = actionSel.value !== "rotate";
      $('[data-opt="pageRange"]').closest(".field").hidden = actionSel.value === "split";
    }
    actionSel.addEventListener("change", syncAction);
    syncAction();

    // ---------- actions ----------
    var actions = {
      text: function () {
        if (!files.text.length) return newPdfFromText();
        var f = files.text[0], items = textEditor.items(), doc, font;
        return loadPdf(f).then(function (d) { doc = d; return doc.embedFont(L.StandardFonts.Helvetica); })
          .then(function (fnt) {
            font = fnt;
            return items.reduce(function (p, it) {
              return p.then(function () {
                var pg = doc.getPage(it.page), box = visibleBox(pg);
                var lines = it.text.split("\n"), lh = it.size * LINE;
                var w = lines.reduce(function (m, ln) { return Math.max(m, lineWidth(font, ln, it.size)); }, 0);
                var top = box.h - it.y; // distance from bottom of page to top of the text box
                if (it.bg) {
                  rectUpright(pg, box, it.x - 1, top - lines.length * lh, w + 2, lines.length * lh, { color: L.rgb(1, 1, 1) });
                }
                return lines.reduce(function (q, ln, k) {
                  return q.then(function () {
                    if (!ln) return;
                    if (canWrite(font, ln)) {
                      drawUpright(pg, box, ln, it.x, top - k * lh - it.size * BASE, { size: it.size, font: font, color: hexToRgb(it.color) });
                      return;
                    }
                    return lineImage(doc, ln, it.size, it.color).then(function (im) {
                      imageUpright(pg, box, im.image, it.x, top - (k + 1) * lh, im.w, im.h);
                    });
                  });
                }, Promise.resolve());
              });
            }, Promise.resolve());
          }).then(function () { return doc.save(); }).then(function (b) {
            download(b, baseName(f) + "-edited.pdf");
            return "Done! Saved " + baseName(f) + "-edited.pdf with " + items.length + " text" + (items.length === 1 ? "" : "s") + " added.";
          });
      },

      merge: function () {
        var out;
        return L.PDFDocument.create().then(function (d) {
          out = d;
          return files.merge.reduce(function (p, f) {
            return p.then(function () { return loadPdf(f); }).then(function (src) {
              return out.copyPages(src, src.getPageIndices());
            }).then(function (pages) { pages.forEach(function (pg) { out.addPage(pg); }); });
          }, Promise.resolve());
        }).then(function () { return out.save(); }).then(function (bytes) {
          download(bytes, "merged.pdf");
          return "Done! " + files.merge.length + " files merged into merged.pdf (" + out.getPageCount() + " pages).";
        });
      },

      images: function () {
        var sizes = { a4: [595.28, 841.89], letter: [612, 792] };
        var mode = opt("imgSize");
        var out;
        return L.PDFDocument.create().then(function (d) {
          out = d;
          return files.images.reduce(function (p, f) {
            return p.then(function () { return embedImage(out, f); }).then(function (img) {
              var w = img.width, h = img.height, page;
              if (mode === "fit") {
                page = out.addPage([w, h]);
                page.drawImage(img, { x: 0, y: 0, width: w, height: h });
              } else {
                var ps = sizes[mode].slice();
                if (w > h) ps.reverse(); // landscape photo → landscape page
                page = out.addPage(ps);
                var m = 24, s = Math.min((ps[0] - 2 * m) / w, (ps[1] - 2 * m) / h);
                page.drawImage(img, { x: (ps[0] - w * s) / 2, y: (ps[1] - h * s) / 2, width: w * s, height: h * s });
              }
            });
          }, Promise.resolve());
        }).then(function () { return out.save(); }).then(function (bytes) {
          var name = files.images.length === 1 ? baseName(files.images[0]) + ".pdf" : "images.pdf";
          download(bytes, name);
          return "Done! " + files.images.length + " image" + (files.images.length === 1 ? "" : "s") + " saved as " + name + ".";
        });
      },

      pages: function () {
        var f = files.pages[0], action = actionSel.value;
        return loadPdf(f).then(function (src) {
          var count = src.getPageCount();
          var name = baseName(f);
          if (action === "split") {
            if (count > 50 && !confirmSplit(count)) return "Cancelled.";
            return src.getPageIndices().reduce(function (p, i) {
              return p.then(function () { return L.PDFDocument.create(); }).then(function (one) {
                return one.copyPages(src, [i]).then(function (pg) { one.addPage(pg[0]); return one.save(); });
              }).then(function (bytes) {
                download(bytes, name + "-page-" + (i + 1) + ".pdf");
                return new Promise(function (r) { setTimeout(r, 250); });
              });
            }, Promise.resolve()).then(function () {
              return "Done! " + count + " files downloaded (one per page). If your browser asks, allow multiple downloads.";
            });
          }
          var sel = parseRange(opt("pageRange"), count);
          if (action === "rotate") {
            var by = +opt("rotateBy");
            sel.forEach(function (i) {
              var pg = src.getPage(i);
              pg.setRotation(L.degrees((pg.getRotation().angle + by) % 360));
            });
            return src.save().then(function (b) {
              download(b, name + "-rotated.pdf");
              return "Done! Rotated " + sel.length + " page" + (sel.length === 1 ? "" : "s") + ".";
            });
          }
          var keep = action === "extract"
            ? sel.slice().sort(function (a, b) { return a - b; })
            : src.getPageIndices().filter(function (i) { return sel.indexOf(i) === -1; });
          if (!keep.length) throw new Error("That would remove every page. Choose fewer pages to delete.");
          return L.PDFDocument.create().then(function (out) {
            return out.copyPages(src, keep).then(function (pgs) {
              pgs.forEach(function (pg) { out.addPage(pg); });
              return out.save();
            });
          }).then(function (b) {
            download(b, name + (action === "extract" ? "-extract.pdf" : "-edited.pdf"));
            return "Done! New PDF has " + keep.length + " page" + (keep.length === 1 ? "" : "s") + ".";
          });
        });
      },

      numbers: function () {
        var f = files.numbers[0];
        var pos = opt("numPos"), style = opt("numStyle");
        var from = Math.max(1, parseInt(opt("numFrom"), 10) || 1);
        var doc;
        return loadPdf(f).then(function (d) { doc = d; return doc.embedFont(L.StandardFonts.Helvetica); })
          .then(function (font) {
            var pages = doc.getPages(), total = pages.length - from + 1;
            if (from > pages.length) throw new Error("This PDF only has " + pages.length + " pages.");
            pages.forEach(function (pg, i) {
              if (i + 1 < from) return;
              var n = i + 2 - from;
              var label = style === "page" ? "Page " + n + " of " + total : String(n);
              var size = 11, tw = font.widthOfTextAtSize(label, size);
              var box = visibleBox(pg);
              var x = pos === "left" ? 36 : pos === "right" ? box.w - 36 - tw : (box.w - tw) / 2;
              drawUpright(pg, box, label, x, 24, { size: size, font: font, color: L.rgb(0.25, 0.25, 0.25) });
            });
            return doc.save();
          }).then(function (b) {
            download(b, baseName(f) + "-numbered.pdf");
            return "Done! Page numbers added.";
          });
      },

      watermark: function () {
        var f = files.watermark[0];
        var text = opt("wmText").trim();
        if (!text) return Promise.reject(new Error("Type the watermark text first."));
        var op = +opt("wmOpacity");
        var doc;
        return loadPdf(f).then(function (d) { doc = d; return doc.embedFont(L.StandardFonts.HelveticaBold); })
          .then(function (font) {
            doc.getPages().forEach(function (pg) {
              var box = visibleBox(pg);
              var diag = Math.sqrt(box.w * box.w + box.h * box.h);
              var size = Math.min(110, (diag * 0.7) / Math.max(1, font.widthOfTextAtSize(text, 1)));
              var tw = font.widthOfTextAtSize(text, size);
              var ang = Math.atan2(box.h, box.w);
              var x = box.w / 2 - (tw / 2) * Math.cos(ang) + (size / 3) * Math.sin(ang);
              var y = box.h / 2 - (tw / 2) * Math.sin(ang) - (size / 3) * Math.cos(ang);
              drawUpright(pg, box, text, x, y, {
                size: size, font: font, color: L.rgb(0.75, 0.1, 0.1), opacity: op,
                rotate: ang * 180 / Math.PI
              });
            });
            return doc.save();
          }).then(function (b) {
            download(b, baseName(f) + "-watermark.pdf");
            return "Done! Watermark added to every page.";
          });
      }
    };

    // Width/height of the visible page area as the reader sees it (after any rotation).
    function visibleBox(pg) {
      var c = pg.getCropBox(), r = ((pg.getRotation().angle % 360) + 360) % 360;
      var b = { r: r, pw: c.width, ph: c.height, ox: c.x, oy: c.y };
      if (r === 90 || r === 270) { b.w = c.height; b.h = c.width; } else { b.w = c.width; b.h = c.height; }
      return b;
    }
    // Convert an "as seen" point (from bottom-left of the visible page) to PDF coordinates.
    function toPdf(box, x, y) {
      var r = box.r, X = x, Y = y;
      if (r === 90) { X = box.pw - y; Y = x; }
      else if (r === 180) { X = box.pw - x; Y = box.ph - y; }
      else if (r === 270) { X = y; Y = box.ph - x; }
      return { x: X + box.ox, y: Y + box.oy, rotate: r };
    }
    // Draw text at (x, y) in "as seen" coordinates, so it is upright even on rotated pages.
    function drawUpright(pg, box, text, x, y, o) {
      var p = toPdf(box, x, y);
      pg.drawText(text, Object.assign({}, o, { x: p.x, y: p.y, rotate: L.degrees((o.rotate || 0) + p.rotate) }));
    }
    function rectUpright(pg, box, x, y, w, h, o) {
      var p = toPdf(box, x, y);
      pg.drawRectangle(Object.assign({}, o, { x: p.x, y: p.y, width: w, height: h, rotate: L.degrees(p.rotate) }));
    }
    function hexToRgb(hex) {
      var n = parseInt(String(hex).replace("#", ""), 16) || 0;
      return L.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    }


    // ---------- text helpers ----------
    // The built-in PDF font only knows English/European letters. Anything else
    // (Urdu, emoji, ...) is drawn by the browser onto a sharp image instead.
    function canWrite(font, s) {
      try { font.widthOfTextAtSize(s, 10); return true; } catch (e) { return false; }
    }
    var mctx = document.createElement("canvas").getContext("2d");
    function cssFont(px) { return px + 'px Helvetica, Arial, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Noto Nastaliq Urdu", sans-serif'; }
    function lineWidth(font, s, size) {
      if (canWrite(font, s)) return font.widthOfTextAtSize(s, size);
      mctx.font = cssFont(size);
      return mctx.measureText(s).width;
    }
    var SHARP = 4; // image resolution: 4 pixels per point
    function lineImage(doc, s, size, color) {
      var w = lineWidth(null, s, size) + size * 0.2, h = size * LINE;
      var c = document.createElement("canvas");
      c.width = Math.ceil(w * SHARP); c.height = Math.ceil(h * SHARP);
      var ctx = c.getContext("2d");
      ctx.scale(SHARP, SHARP);
      ctx.font = cssFont(size);
      ctx.fillStyle = color;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(s, 0, size * BASE);
      return new Promise(function (res) { c.toBlob(res, "image/png"); })
        .then(function (blob) { return blob.arrayBuffer(); })
        .then(function (buf) { return doc.embedPng(buf); })
        .then(function (image) { return { image: image, w: c.width / SHARP, h: c.height / SHARP }; });
    }
    function imageUpright(pg, box, image, x, y, w, h) {
      var p = toPdf(box, x, y);
      pg.drawImage(image, { x: p.x, y: p.y, width: w, height: h, rotate: L.degrees(p.rotate) });
    }
    // Break text into lines that fit maxW points.
    function wrapText(font, text, size, maxW) {
      var out = [];
      text.split("\n").forEach(function (para) {
        if (!para.trim()) { out.push(""); return; }
        var line = "";
        para.split(/(\s+)/).forEach(function (word) {
          var test = line + word;
          if (!line || lineWidth(font, test.trimEnd(), size) <= maxW) { line = test; return; }
          out.push(line.trimEnd());
          line = word.trim() ? word : "";
          while (line && lineWidth(font, line, size) > maxW) { // very long word: cut it
            var k = line.length - 1;
            while (k > 1 && lineWidth(font, line.slice(0, k), size) > maxW) k--;
            out.push(line.slice(0, k)); line = line.slice(k);
          }
        });
        out.push(line.trimEnd());
      });
      return out;
    }
    // No PDF chosen: make a new A4 PDF from the typed text.
    function newPdfFromText() {
      var text = $('[data-opt="txtValue"]').value.replace(/\s+$/, "");
      if (!text) return Promise.reject(new Error("Type your text in box 1 first."));
      var size = +$('[data-opt="txtSize"]').value, color = $('[data-opt="txtColor"]').value;
      var W = 595.28, H = 841.89, M = 56, lh = size * LINE, doc, font;
      return L.PDFDocument.create().then(function (d) { doc = d; return doc.embedFont(L.StandardFonts.Helvetica); })
        .then(function (fnt) {
          font = fnt;
          var lines = wrapText(font, text, size, W - 2 * M);
          var page = null, y = 0;
          return lines.reduce(function (p, ln) {
            return p.then(function () {
              if (!page || y - lh < M) { page = doc.addPage([W, H]); y = H - M; }
              var top = y; y -= lh;
              if (!ln) return;
              if (canWrite(font, ln)) {
                page.drawText(ln, { x: M, y: top - size * BASE, size: size, font: font, color: hexToRgb(color) });
                return;
              }
              return lineImage(doc, ln, size, color).then(function (im) {
                page.drawImage(im.image, { x: M, y: top - im.h, width: im.w, height: im.h });
              });
            });
          }, Promise.resolve());
        }).then(function () { return doc.save(); }).then(function (b) {
          download(b, "my-text.pdf");
          var n = doc.getPageCount();
          return "Done! Saved my-text.pdf (" + n + " page" + (n === 1 ? "" : "s") + ").";
        });
    }

    // ---------- Add text: page preview + placing text ----------
    var LINE = 1.2, BASE = 0.95; // line height and baseline position (× font size), same as the preview
    var textEditor = (function () {
      var PJ = window.pdfjsLib;
      if (PJ) PJ.GlobalWorkerOptions.workerSrc = "js/vendor/pdfjs/pdf.worker.min.js";
      var wrap = $("[data-text-editor]"), stage = $("[data-stage]"), canvas = stage.querySelector("canvas");
      var label = $("[data-page-label]"), runBtn = $('[data-run="text"]'), noPdfHint = $("[data-nopdf]");
      var inText = $('[data-opt="txtValue"]'), inSize = $('[data-opt="txtSize"]'),
          inColor = $('[data-opt="txtColor"]'), inBg = $('[data-opt="txtBg"]');
      var doc = null, pageNo = 0, scale = 1, items = [], sel = -1, token = 0, renderTask = null;

      function sync() {
        runBtn.disabled = doc ? !items.length : (files.text.length > 0 || !inText.value.trim());
        runBtn.textContent = doc || files.text.length ? "Save & download" : "Download as PDF";
        noPdfHint.hidden = !!(doc || files.text.length);
      }

      function reset() {
        if (doc) doc.destroy();
        doc = null; items = []; sel = -1; wrap.hidden = true; sync();
      }

      function load(file) {
        reset();
        if (!file) return;
        if (!PJ) { status("text", "The page preview didn't load. Refresh the page and try again.", "err"); return; }
        var my = ++token;
        status("text", "Opening…");
        file.arrayBuffer().then(function (buf) {
          return PJ.getDocument({ data: new Uint8Array(buf) }).promise;
        }).then(function (d) {
          if (my !== token) { d.destroy(); return; }
          doc = d; pageNo = 0; wrap.hidden = false;
          status("text", inText.value.trim() ? "Now click on the page where your text should go." : "Type your text in box 1, then click on the page where it should go.");
          return show();
        }).catch(function (e) {
          if (my !== token) return;
          status("text", /password/i.test(e && e.name + e.message)
            ? "“" + file.name + "” is password-protected. Unlock it first, then try again."
            : "“" + file.name + "” could not be opened. Is it a real PDF file?", "err");
        });
      }

      function show() {
        if (!doc) return;
        label.textContent = "Page " + (pageNo + 1) + " of " + doc.numPages;
        return doc.getPage(pageNo + 1).then(function (page) {
          var base = page.getViewport({ scale: 1 });
          var avail = Math.max(260, wrap.querySelector(".stage-wrap").clientWidth - 30);
          scale = Math.min(1.6, avail / base.width);
          var vp = page.getViewport({ scale: scale });
          var dpr = window.devicePixelRatio || 1;
          canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr);
          canvas.style.width = vp.width + "px"; canvas.style.height = vp.height + "px";
          stage.style.width = vp.width + "px"; stage.style.height = vp.height + "px";
          if (renderTask) renderTask.cancel();
          renderTask = page.render({ canvasContext: canvas.getContext("2d"), viewport: vp,
                                     transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
          drawItems();
          return renderTask.promise.catch(function () {});
        });
      }

      function drawItems() {
        stage.querySelectorAll(".txt-item").forEach(function (n) { n.remove(); });
        items.forEach(function (it, i) {
          if (it.page !== pageNo) return;
          var d = document.createElement("div");
          d.className = "txt-item" + (i === sel ? " sel" : "");
          d.setAttribute("data-i", i);
          d.textContent = it.text;
          d.style.left = it.x * scale + "px";
          d.style.top = it.y * scale + "px";
          d.style.fontSize = it.size * scale + "px";
          d.style.color = it.color;
          d.style.background = it.bg ? "#fff" : "transparent";
          var x = document.createElement("button");
          x.type = "button"; x.className = "x"; x.textContent = "✕"; x.setAttribute("aria-label", "Delete this text");
          d.appendChild(x);
          stage.appendChild(d);
        });
        sync();
      }

      function current() {
        return { text: inText.value.replace(/\s+$/, ""), size: +inSize.value, color: inColor.value, bg: inBg.checked };
      }

      // Click empty page → add text. Click text → select it. Drag text → move.
      var drag = null;
      stage.addEventListener("pointerdown", function (e) {
        if (!doc) return;
        var r = stage.getBoundingClientRect();
        var px = e.clientX - r.left, py = e.clientY - r.top;
        if (e.target.classList.contains("x")) return;
        var el = e.target.closest(".txt-item");
        if (el) {
          sel = +el.getAttribute("data-i");
          var it = items[sel];
          inText.value = it.text; inSize.value = String(it.size); inColor.value = it.color; inBg.checked = it.bg;
          drag = { id: e.pointerId, dx: px - it.x * scale, dy: py - it.y * scale };
          stage.setPointerCapture(e.pointerId);
          drawItems();
          return;
        }
        if (sel >= 0) { // first click on empty space just finishes editing the selected text
          sel = -1; inText.value = ""; drawItems();
          status("text", "Type your next text, then click on the page where it should go.");
          return;
        }
        var c = current();
        if (!c.text) { status("text", "Type your text in the box above first, then click the page.", "err"); inText.focus(); return; }
        items.push({ page: pageNo, x: px / scale, y: py / scale - (c.size * LINE) / 2,
                     text: c.text, size: c.size, color: c.color, bg: c.bg });
        sel = -1;
        inText.value = "";
        drawItems();
        status("text", items.length + " text" + (items.length === 1 ? "" : "s") + " added. Type more text and click again, or click “Save & download”.");
      });
      stage.addEventListener("pointermove", function (e) {
        if (!drag || e.pointerId !== drag.id || sel < 0) return;
        var r = stage.getBoundingClientRect();
        items[sel].x = Math.max(0, (e.clientX - r.left - drag.dx) / scale);
        items[sel].y = Math.max(0, (e.clientY - r.top - drag.dy) / scale);
        var el = stage.querySelector('.txt-item[data-i="' + sel + '"]');
        if (el) { el.style.left = items[sel].x * scale + "px"; el.style.top = items[sel].y * scale + "px"; }
      });
      ["pointerup", "pointercancel"].forEach(function (ev) {
        stage.addEventListener(ev, function () { drag = null; });
      });
      stage.addEventListener("click", function (e) {
        var x = e.target.closest(".x");
        if (!x) return;
        var i = +x.parentNode.getAttribute("data-i");
        items.splice(i, 1);
        sel = -1;
        drawItems();
        status("text", items.length ? items.length + " text" + (items.length === 1 ? "" : "s") + " on the PDF." : "Text removed.");
      });

      // Changing the controls updates the selected text.
      inText.addEventListener("input", sync);
      [inText, inSize, inColor, inBg].forEach(function (inp) {
        inp.addEventListener(inp === inText ? "input" : "change", function () {
          if (sel < 0 || !items[sel]) return;
          var c = current();
          if (!c.text) return;
          Object.assign(items[sel], c);
          drawItems();
        });
      });

      document.querySelectorAll("[data-page]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (!doc) return;
          var n = pageNo + +b.getAttribute("data-page");
          if (n < 0 || n >= doc.numPages) return;
          pageNo = n; sel = -1; show();
        });
      });
      var rt;
      window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(show, 200); });

      sync();
      return { load: load, reset: reset, sync: sync, items: function () { return items; } };
    })();

    function confirmSplit(n) {
      return window.confirm("This will download " + n + " separate files. Continue?");
    }

    // Embed any browser-readable image. JPG/PNG directly; others converted via canvas.
    function embedImage(doc, f) {
      return f.arrayBuffer().then(function (buf) {
        var b = new Uint8Array(buf);
        if (b[0] === 0xFF && b[1] === 0xD8) return doc.embedJpg(buf);
        if (b[0] === 0x89 && b[1] === 0x50) return doc.embedPng(buf);
        return new Promise(function (resolve, reject) {
          var url = URL.createObjectURL(f), img = new Image();
          img.onload = function () {
            var c = document.createElement("canvas");
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            var ctx = c.getContext("2d");
            ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            c.toBlob(function (blob) {
              blob.arrayBuffer().then(function (jb) { return doc.embedJpg(jb); }).then(resolve, reject);
            }, "image/jpeg", 0.92);
          };
          img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("“" + f.name + "” isn't an image this browser can read. Try JPG or PNG.")); };
          img.src = url;
        });
      });
    }

    document.querySelectorAll("[data-run]").forEach(function (btn) {
      var tool = btn.getAttribute("data-run");
      btn.addEventListener("click", function () {
        if (!L) { status(tool, "The PDF library didn't load. Refresh the page and try again.", "err"); return; }
        btn.disabled = true;
        status(tool, "Working… please wait.");
        Promise.resolve().then(actions[tool]).then(function (msg) {
          status(tool, msg, "ok");
        }).catch(function (e) {
          console.error(e);
          status(tool, (e && e.message) || "Something went wrong.", "err");
        }).then(function () { btn.disabled = false; if (tool === "text") textEditor.sync(); });
      });
    });
  })();
