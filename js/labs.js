/* ============================================================
   実験ウィジェット（メモリのしくみクエスト）
   <div class="lab" data-lab="種類" data-id="課題ID"> を見つけて組み立てる。
   data-id があるものは、目標を達成すると QUEST.taskDone で課題達成になる。
   ============================================================ */
(function (global) {
  "use strict";

  function hex(n, w) { return "0x" + ("0000" + n.toString(16).toUpperCase()).slice(-(w || 2)); }
  function head(title) {
    return '<div class="lab-head"><span class="lab-badge">実験</span><span class="lab-title">' + title + "</span></div>";
  }
  function prepTask(root) {
    var id = root.getAttribute("data-id");
    if (id) root.setAttribute("data-task", id);
    return !!(id && global.QUEST && global.QUEST.isTaskDone(id));
  }
  function done(root, msg) {
    if (!root.classList.contains("solved")) {
      root.classList.add("solved");
      var b = root.querySelector(".lab-badge");
      if (b) b.textContent = "✓ 達成";
      var id = root.getAttribute("data-id");
      if (id && global.QUEST) global.QUEST.taskDone(root, id);
    }
    var s = root.querySelector(".lab-status");
    if (s && msg) { s.textContent = msg; s.className = "lab-status ok"; }
  }
  function status(root, msg) {
    var s = root.querySelector(".lab-status");
    if (s) { s.textContent = msg; s.className = "lab-status"; }
  }

  /* ---------- 1. 番地のマス目 ---------- */
  function ram(root) {
    var already = prepTask(root);
    var N = 32;
    var mem = [];
    for (var i = 0; i < N; i++) mem.push((i * 37 + 11) % 256);
    // 0x10〜0x13 に 4バイトの数 1000（下の桁のバイトが小さい番地）
    mem[0x10] = 0xE8; mem[0x11] = 0x03; mem[0x12] = 0x00; mem[0x13] = 0x00;
    var targets = [0x05, 0x1A, 0x10];
    var got = [];
    root.innerHTML = head("メモリの番地と中身") +
      '<div class="memgrid" role="grid"></div><p class="readout"></p><div class="target-list"></div><p class="lab-status" aria-live="polite"></p>';
    var g = root.querySelector(".memgrid");
    for (var a = 0; a < N; a++) {
      (function (a) {
        var c = document.createElement("button");
        c.type = "button";
        c.className = "memcell" + (a >= 0x10 && a <= 0x13 ? " int" : "");
        c.innerHTML = "<small>" + hex(a) + "</small><b>" + mem[a] + "</b>";
        c.addEventListener("click", function () { pick(a); });
        g.appendChild(c);
      })(a);
    }
    function pick(a) {
      g.querySelectorAll(".memcell").forEach(function (c, i) { c.classList.toggle("on", i === a); });
      var bits = ("0000000" + mem[a].toString(2)).slice(-8);
      var extra = a >= 0x10 && a <= 0x13 ? "　この4マスで1つの数 1000 を表している（1000＝3×256＋232）" : "";
      root.querySelector(".readout").innerHTML = "番地 <b>" + hex(a) + "</b>（10進数で " + a + "）の中身：<b>" + mem[a] + "</b>（2進数 " + bits + "）" + extra;
      var next = targets.filter(function (t) { return got.indexOf(t) === -1; })[0];
      if (a === next) got.push(a);
      draw();
    }
    function draw() {
      var tl = root.querySelector(".target-list");
      var next = targets.filter(function (t) { return got.indexOf(t) === -1; })[0];
      tl.innerHTML = targets.map(function (t) {
        var ok = got.indexOf(t) !== -1 || already;
        return '<span class="target-chip' + (ok ? " done" : t === next ? " now" : "") + '">' + (ok ? "✓ " : "") + hex(t) + "</span>";
      }).join("");
      if (next === undefined || already) done(root, "3つとも見つけた！");
      else status(root, "番地 " + hex(next) + " のマスを押して、中身を読もう");
    }
    draw();
  }

  /* ---------- 2. レジスタとメモリの往復（かかる時間つき） ---------- */
  function cpu(root) {
    var already = prepTask(root);
    var PROG = [["LOAD", 6], ["ADD", 7], ["STORE", 5], ["HALT", 0], 0, 0, 3, 4];
    var st;
    root.innerHTML = head("CPU とメモリの往復（3＋4）") +
      '<div class="row"><button type="button" class="btn btn-primary lab-step">命令を1つ実行</button><button type="button" class="btn lab-reset">最初から</button></div>' +
      '<div class="cpu-grid"><div class="cpu-box"><h4>CPU</h4><table class="regs"></table></div><div class="cpu-box"><h4>メモリ（番地：中身）</h4><table class="mem"></table></div></div>' +
      '<div class="cpu-log" aria-live="polite"></div><p class="lab-status"></p>';
    function reset() {
      st = { mem: PROG.map(function (x) { return Array.isArray(x) ? x.slice() : x; }), pc: 0, A: 0, t: 0, halted: false, hl: -1 };
      root.querySelector(".cpu-log").innerHTML = "番地6 と番地7 の数を足して、番地5 にしまうプログラム。";
      draw();
    }
    function fmt(x) { return Array.isArray(x) ? x[0] + (x[0] === "HALT" ? "" : " " + x[1]) : "データ " + x; }
    function draw() {
      root.querySelector(".regs").innerHTML =
        "<tr><td>PC</td><td><b>" + st.pc + "</b></td></tr><tr><td>レジスタ A</td><td><b>" + st.A + "</b></td></tr>" +
        "<tr><td>かかった時間</td><td><b>" + st.t + "</b> 拍</td></tr>";
      root.querySelector(".mem").innerHTML = st.mem.map(function (x, i) {
        return '<tr class="' + (i === st.pc && !st.halted ? "pc " : "") + (i === st.hl ? "hl" : "") + '"><td>' + i + "</td><td>" + fmt(x) + "</td></tr>";
      }).join("");
    }
    function step() {
      if (st.halted) return;
      var ins = st.mem[st.pc];
      var cost = 100; // 命令をメモリから取り出す
      var msg = "取り出し（メモリ 100拍）→ ";
      st.pc++;
      var op = ins[0], n = ins[1];
      st.hl = n;
      if (op === "LOAD") { st.A = st.mem[n]; cost += 100; msg += "番地" + n + " を読む（メモリ 100拍）→ A＝" + st.A; }
      else if (op === "ADD") { cost += 100 + 1; st.A += st.mem[n]; msg += "番地" + n + " を読む（100拍）＋ 足し算（ALU 1拍）→ A＝" + st.A; }
      else if (op === "STORE") { st.mem[n] = st.A; cost += 100; msg += "A を番地" + n + " に書く（100拍）"; }
      else { st.halted = true; st.hl = -1; msg = "停止"; cost = 0; }
      st.t += cost;
      root.querySelector(".cpu-log").innerHTML = op + "：" + msg;
      draw();
      if (st.halted) done(root, "合計 " + st.t + " 拍のうち、計算そのものは 1 拍だけ。残りはメモリとの往復の待ち時間。");
    }
    root.querySelector(".lab-step").addEventListener("click", step);
    root.querySelector(".lab-reset").addEventListener("click", reset);
    reset();
    if (already) done(root, "この課題は達成済み");
  }

  /* ---------- 3. キャッシュ（ライン4バイト・4本・LRU） ---------- */
  function cache(root) {
    var already = prepTask(root);
    var LINE = 4, LINES = 4;
    var PATTERNS = {
      seq: { name: "前から順に32バイト読む", seq: (function () { var a = []; for (var i = 0; i < 32; i++) a.push(i); return a; })() },
      stride: { name: "4バイトおきに16回読む", seq: (function () { var a = []; for (var i = 0; i < 64; i += 4) a.push(i); return a; })() },
      reuse: { name: "同じ8バイトを3回くり返し読む", seq: (function () { var a = []; for (var r = 0; r < 3; r++) for (var i = 0; i < 8; i++) a.push(i); return a; })() }
    };
    var ran = {};
    var timer = null;
    root.innerHTML = head("キャッシュに当たるか外れるか") +
      '<div class="row pat"></div>' +
      '<div class="cache-wrap"><div><h4>キャッシュ（4本 × 4バイト）</h4><div class="cache-lines"></div></div><div><h4>メモリ（64バイト・4バイトずつの線）</h4><div class="cache-mem"></div></div></div>' +
      '<p class="readout"></p><p class="lab-status" aria-live="polite"></p>';
    var pat = root.querySelector(".pat");
    Object.keys(PATTERNS).forEach(function (k) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn"; b.textContent = "▶ " + PATTERNS[k].name;
      b.addEventListener("click", function () { run(k); });
      pat.appendChild(b);
    });
    var memEl = root.querySelector(".cache-mem");
    for (var i = 0; i < 64; i++) {
      var c = document.createElement("span");
      c.className = "cm" + (i % LINE === 0 ? " ls" : "");
      memEl.appendChild(c);
    }
    function draw(lines, addr, hit, hits, total) {
      root.querySelector(".cache-lines").innerHTML = lines.map(function (l) {
        return '<div class="cl' + (l && addr !== null && Math.floor(addr / LINE) === l.tag ? (hit ? " hit" : " miss") : "") + '">' +
          (l ? "番地 " + l.tag * LINE + "〜" + (l.tag * LINE + 3) : "（空）") + "</div>";
      }).join("");
      memEl.querySelectorAll(".cm").forEach(function (c, i) {
        var inCache = lines.some(function (l) { return l && Math.floor(i / LINE) === l.tag; });
        c.className = "cm" + (i % LINE === 0 ? " ls" : "") + (inCache ? " in" : "") + (i === addr ? " now" : "");
      });
      root.querySelector(".readout").innerHTML = total ? "当たり <b>" + hits + "</b> ／ " + total + " 回（当たる割合 <b>" + Math.round(hits / total * 100) + "%</b>）" : "";
    }
    function run(k) {
      if (timer) clearInterval(timer);
      var seq = PATTERNS[k].seq, lines = [null, null, null, null], used = [0, 0, 0, 0], clock = 0, hits = 0, i = 0;
      pat.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
      timer = setInterval(function () {
        if (i >= seq.length) {
          clearInterval(timer); timer = null;
          pat.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
          ran[k] = true;
          var all = Object.keys(PATTERNS).every(function (x) { return ran[x]; });
          if (all || already) done(root, "3つの読み方を全部試した。並び方しだいで、当たる割合がこんなに違う。");
          else status(root, "「" + PATTERNS[k].name + "」は当たる割合 " + Math.round(hits / seq.length * 100) + "%。ほかの読み方も試そう。");
          return;
        }
        var addr = seq[i++], tag = Math.floor(addr / LINE), hit = false;
        clock++;
        for (var j = 0; j < LINES; j++) if (lines[j] && lines[j].tag === tag) { hit = true; used[j] = clock; }
        if (hit) hits++;
        else {
          var v = lines.indexOf(null);
          if (v < 0) { v = 0; for (var q = 1; q < LINES; q++) if (used[q] < used[v]) v = q; }
          lines[v] = { tag: tag }; used[v] = clock;
        }
        draw(lines, addr, hit, hits, i);
        status(root, "番地 " + addr + " を読む → " + (hit ? "当たり（キャッシュにあった）" : "外れ（メモリから4バイトまとめて運ぶ）"));
      }, global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches ? 30 : 140);
    }
    draw([null, null, null, null], null, false, 0, 0);
    if (already) done(root, "この課題は達成済み");
    else status(root, "3つの読み方を順に試そう");
  }

  /* ---------- 4. スタック（関数の呼び出し） ---------- */
  function stack(root) {
    var already = prepTask(root);
    var CODE = [
      "int square(int x) {",
      "  int y = x * x;",
      "  return y;",
      "}",
      "int main(void) {",
      "  int a = 3;",
      "  int b = square(a);",
      "  int c = b + 1;",
      "}"
    ];
    var STEPS = [
      { line: 4, frames: [{ name: "main", vars: [["a", "?"], ["b", "?"], ["c", "?"]] }], msg: "main が始まる。main の板（スタックフレーム）が積まれ、ローカル変数 a, b, c の場所が取られる。" },
      { line: 5, frames: [{ name: "main", vars: [["a", "3"], ["b", "?"], ["c", "?"]] }], msg: "a に 3 を書き込む。" },
      { line: 6, frames: [{ name: "main", vars: [["a", "3"], ["b", "?"], ["c", "?"]] }, { name: "square", vars: [["戻り先", "main の6行目"], ["x", "3"], ["y", "?"]] }], msg: "square を呼ぶ。新しい板を上に積み、戻り先（呼び出した場所）と、引数 x にコピーした 3 をしまう。" },
      { line: 1, frames: [{ name: "main", vars: [["a", "3"], ["b", "?"], ["c", "?"]] }, { name: "square", vars: [["戻り先", "main の6行目"], ["x", "3"], ["y", "9"]] }], msg: "y ＝ x × x ＝ 9。" },
      { line: 2, frames: [{ name: "main", vars: [["a", "3"], ["b", "9"], ["c", "?"]] }], msg: "return y：答え 9 を渡し、square の板を丸ごと取り除く（x と y は消える）。戻り先を見て main の6行目へ戻り、b ＝ 9。" },
      { line: 7, frames: [{ name: "main", vars: [["a", "3"], ["b", "9"], ["c", "10"]] }], msg: "c ＝ b ＋ 1 ＝ 10。" },
      { line: 8, frames: [], msg: "main が終わり、main の板も取り除かれる。スタックは空に戻った。" }
    ];
    var k = 0;
    root.innerHTML = head("関数を呼ぶとスタックに板が積まれる") +
      '<div class="row"><button type="button" class="btn btn-primary lab-step">1行すすめる</button><button type="button" class="btn lab-reset">最初から</button></div>' +
      '<div class="stack-wrap"><pre class="code"></pre><div><h4>スタック（上に積む）</h4><div class="frames"></div></div></div>' +
      '<p class="lab-status" aria-live="polite"></p>';
    function draw() {
      var s = STEPS[k];
      root.querySelector(".code").innerHTML = CODE.map(function (l, i) {
        return '<span class="' + (i === s.line ? "cur" : "") + '">' + l.replace(/</g, "&lt;") + "</span>";
      }).join("\n");
      root.querySelector(".frames").innerHTML = s.frames.length ? s.frames.slice().reverse().map(function (f, i) {
        return '<div class="frame' + (i === 0 ? " top" : "") + '"><div class="fname">' + f.name + " の板</div>" +
          f.vars.map(function (v) { return '<div class="fvar"><span>' + v[0] + "</span><b>" + v[1] + "</b></div>"; }).join("") + "</div>";
      }).join("") : '<div class="frame empty">（空）</div>';
      if (k === STEPS.length - 1) done(root, s.msg);
      else status(root, s.msg);
    }
    root.querySelector(".lab-step").addEventListener("click", function () { if (k < STEPS.length - 1) { k++; draw(); } });
    root.querySelector(".lab-reset").addEventListener("click", function () { k = 0; draw(); });
    draw();
    if (already) done(root);
  }

  /* ---------- 5. ヒープ（借りる・返す・断片化） ---------- */
  function heap(root) {
    var already = prepTask(root);
    var N = 16;
    var cells, blocks, nextName;
    var COLORS = ["#c9b6ef", "#b6e3d4", "#f6d29a", "#f3b6c4", "#b6cdf0", "#d8e6a4"];
    root.innerHTML = head("ヒープを借りて返す") +
      '<div class="row req"></div>' +
      '<div class="heapbar"></div>' +
      '<p class="readout"></p><p class="lab-status" aria-live="polite"></p>' +
      '<div class="row"><button type="button" class="btn lab-reset">全部返して最初から</button></div>';
    [2, 3, 4, 6].forEach(function (sz) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn btn-primary"; b.textContent = sz + "マス借りる";
      b.addEventListener("click", function () { alloc(sz); });
      root.querySelector(".req").appendChild(b);
    });
    function reset() { cells = []; for (var i = 0; i < N; i++) cells.push(null); blocks = {}; nextName = 0; draw(); status(root, "借りたブロックをタップすると返せる。「空きの合計は足りるのに借りられない」状態を作ってみよう。"); }
    function freeCount() { return cells.filter(function (c) { return c === null; }).length; }
    function maxRun() { var m = 0, r = 0; cells.forEach(function (c) { r = c === null ? r + 1 : 0; if (r > m) m = r; }); return m; }
    function alloc(sz) {
      for (var i = 0; i + sz <= N; i++) {
        var ok = true;
        for (var j = i; j < i + sz; j++) if (cells[j] !== null) { ok = false; break; }
        if (ok) {
          var name = String.fromCharCode(65 + (nextName++ % 26));
          blocks[name] = { start: i, size: sz, color: COLORS[(nextName - 1) % COLORS.length] };
          for (j = i; j < i + sz; j++) cells[j] = name;
          draw();
          status(root, name + " に " + sz + "マス貸した（番地 " + i + "〜" + (i + sz - 1) + "）。");
          return;
        }
      }
      draw();
      if (freeCount() >= sz) done(root, "空きは合計 " + freeCount() + "マスあるのに、" + sz + "マス続いた空きが無いので借りられない。これが断片化（空きが細切れ）。");
      else status(root, "空きが " + freeCount() + "マスしか無いので、" + sz + "マスは借りられない。どれかを返してみよう。");
    }
    function draw() {
      var bar = root.querySelector(".heapbar");
      bar.innerHTML = "";
      cells.forEach(function (c, i) {
        var d = document.createElement("button");
        d.type = "button";
        d.className = "hc" + (c ? " used" : "");
        d.style.background = c ? blocks[c].color : "";
        d.innerHTML = "<small>" + i + "</small>" + (c ? c : "");
        d.setAttribute("aria-label", "番地" + i + (c ? " " + c + " が使用中" : " 空き"));
        if (c) d.addEventListener("click", function () {
          var b = blocks[c];
          for (var j = b.start; j < b.start + b.size; j++) cells[j] = null;
          delete blocks[c];
          draw();
          status(root, c + " を返した。");
        });
        bar.appendChild(d);
      });
      root.querySelector(".readout").innerHTML = "空きの合計 <b>" + freeCount() + "</b> マス ／ 続いている空きの最大 <b>" + maxRun() + "</b> マス";
    }
    root.querySelector(".lab-reset").addEventListener("click", reset);
    reset();
    if (already) done(root, "この課題は達成済み");
  }

  /* ---------- 6. ポインタ ---------- */
  function pointer(root) {
    var st;
    root.innerHTML = head("番地をしまう変数（ポインタ）") +
      '<div class="row ops"></div><div class="ptr-mem"></div><p class="lab-status" aria-live="polite"></p>';
    var OPS = [
      ["p = &x", function () { st.p = 0x20; return "p に x の番地 0x20 をしまった。p は x を指している。"; }],
      ["p = &y", function () { st.p = 0x24; return "p に y の番地 0x24 をしまった。p は y を指している。"; }],
      ["*p = 10", function () { if (st.p === 0x20) st.x = 10; else st.y = 10; return "p が指す番地（" + hex(st.p) + "）に 10 を書いた。p そのものは変わらない。"; }],
      ["x = 7", function () { st.x = 7; return "x に直接 7 を書いた。"; }],
      ["最初から", function () { st = { x: 5, y: 8, p: 0x20 }; return "int x = 5; int y = 8; int *p = &x; の状態。"; }]
    ];
    OPS.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn" + (o[0] === "最初から" ? "" : " btn-primary"); b.textContent = o[0];
      b.addEventListener("click", function () { status(root, o[1]()); draw(); });
      root.querySelector(".ops").appendChild(b);
    });
    function draw() {
      var rows = [[0x20, "x", st.x, "int（4バイト）"], [0x24, "y", st.y, "int（4バイト）"], [0x28, "p", hex(st.p), "番地（8バイト）"]];
      root.querySelector(".ptr-mem").innerHTML = rows.map(function (r) {
        var pointed = r[0] === st.p;
        return '<div class="pm' + (pointed ? " pointed" : "") + (r[1] === "p" ? " isp" : "") + '"><small>' + hex(r[0]) + "</small><span>" + r[1] + "</span><b>" + r[2] + "</b><em>" + r[3] + "</em>" + (pointed ? '<i>← p が指している</i>' : "") + "</div>";
      }).join("") + '<p class="readout">*p（p が指す先の値）＝ <b>' + (st.p === 0x20 ? st.x : st.y) + "</b></p>";
    }
    st = { x: 5, y: 8, p: 0x20 };
    status(root, "int x = 5; int y = 8; int *p = &x; の状態。");
    draw();
  }

  /* ---------- 7. ガベージコレクション（マーク＆スイープ） ---------- */
  function gc(root) {
    var already = prepTask(root);
    var NODES = { A: [130, 70], B: [130, 190], C: [245, 60], D: [365, 75], E: [250, 195], F: [370, 195] };
    var EDGES = [["A", "C"], ["C", "D"], ["B", "D"], ["E", "F"], ["F", "E"]];
    var ROOTS = ["A", "B"];
    var st;
    root.innerHTML = head("たどれないものを片付ける（マーク＆スイープ）") +
      '<div class="row"><button type="button" class="btn btn-primary lab-mark">① 印を付ける（1歩）</button><button type="button" class="btn btn-primary lab-sweep">② 印の無いものを片付ける</button><button type="button" class="btn lab-reset">最初から</button><button type="button" class="btn lab-rc">参照の数を表示</button></div>' +
      '<svg viewBox="0 0 420 250" width="420" role="img" aria-label="オブジェクトのつながり"></svg>' +
      '<p class="lab-status" aria-live="polite"></p>';
    var svg = root.querySelector("svg");
    var showRc = false;
    function reset() { st = { marked: {}, frontier: ROOTS.slice(), alive: { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1 }, swept: false }; draw(); status(root, "変数（ルート）から矢印をたどれるものに印を付けていこう。"); }
    function draw() {
      var NS = "http://www.w3.org/2000/svg", h = "";
      h += '<defs><marker id="gcarrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#6f6488"/></marker></defs>';
      h += '<rect x="4" y="4" width="62" height="242" rx="10" fill="none" stroke="#b9a9dc" stroke-dasharray="5 4"/><text x="35" y="240" text-anchor="middle" font-size="10" fill="#6f6488">ルート</text>';
      ROOTS.forEach(function (r, i) { h += '<rect x="12" y="' + (NODES[r][1] - 13) + '" width="46" height="26" rx="5" fill="#fff" stroke="#8d80ab"/><text x="35" y="' + (NODES[r][1] + 4) + '" text-anchor="middle" font-size="11" font-weight="900">変数' + "xy"[i] + "</text>"; });
      EDGES.concat(ROOTS.map(function (r) { return ["root", r]; })).forEach(function (e) {
        if (e[0] !== "root" && (!st.alive[e[0]] || !st.alive[e[1]])) return;
        var a = e[0] === "root" ? [58, NODES[e[1]][1]] : NODES[e[0]], b = NODES[e[1]];
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
        var off = e[0] === "E" || e[0] === "F" ? 8 : 0;
        var nx = -dy / L * off, ny = dx / L * off;
        var r0 = e[0] === "root" ? 0 : 24;
        h += '<line x1="' + (a[0] + dx / L * r0 + nx) + '" y1="' + (a[1] + dy / L * r0 + ny) + '" x2="' + (b[0] - dx / L * 26 + nx) + '" y2="' + (b[1] - dy / L * 26 + ny) + '" stroke="#6f6488" stroke-width="2" marker-end="url(#gcarrow)"/>';
      });
      Object.keys(NODES).forEach(function (n) {
        if (!st.alive[n]) return;
        var p = NODES[n], m = st.marked[n];
        var rc = EDGES.filter(function (e) { return e[1] === n && st.alive[e[0]]; }).length + (ROOTS.indexOf(n) !== -1 ? 1 : 0);
        h += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="24" fill="' + (m ? "#ffe08a" : "#efeaf8") + '" stroke="' + (m ? "#c48a06" : "#8d80ab") + '" stroke-width="2"/>';
        h += '<text x="' + p[0] + '" y="' + (p[1] + 5) + '" text-anchor="middle" font-size="15" font-weight="900">' + n + "</text>";
        if (showRc) h += '<text x="' + (p[0] + 22) + '" y="' + (p[1] - 18) + '" font-size="11" font-weight="900" fill="#a14b7a">参照' + rc + "</text>";
        if (m) h += '<text x="' + (p[0] - 22) + '" y="' + (p[1] - 18) + '" font-size="13">✔</text>';
      });
      svg.innerHTML = h;
    }
    root.querySelector(".lab-mark").addEventListener("click", function () {
      if (st.swept) return;
      if (!st.frontier.length) { status(root, "これ以上たどれるものは無い。次は②で片付けよう。"); return; }
      var n = st.frontier.shift();
      if (!st.marked[n]) {
        st.marked[n] = true;
        EDGES.forEach(function (e) { if (e[0] === n && !st.marked[e[1]]) st.frontier.push(e[1]); });
        status(root, n + " に印を付けた。" + n + " から矢印が出ている先も、あとで調べる。");
      } else status(root, n + " はもう印が付いている。");
      draw();
    });
    root.querySelector(".lab-sweep").addEventListener("click", function () {
      if (st.frontier.length) { status(root, "まだたどっていない矢印がある。①を続けよう。"); return; }
      var gone = [];
      Object.keys(st.alive).forEach(function (n) { if (st.alive[n] && !st.marked[n]) { st.alive[n] = 0; gone.push(n); } });
      st.swept = true;
      draw();
      done(root, "印の無い " + gone.join("・") + " を片付けた。E と F はお互いを指し合っていても、変数からたどれないので片付けられた。");
    });
    root.querySelector(".lab-reset").addEventListener("click", reset);
    root.querySelector(".lab-rc").addEventListener("click", function () { showRc = !showRc; draw(); });
    reset();
    if (already) done(root, "この課題は達成済み");
  }

  /* ---------- 8. メモリの配置（区画に振り分ける） ---------- */
  function layout(root) {
    var already = prepTask(root);
    var REG = ["コード", "読み取り専用データ", "初期化済みデータ", "未初期化データ", "ヒープ", "スタック"];
    var ITEMS = [
      ["関数 main の命令（機械語）", 0],
      ["文字列 \"hello\"（プログラムに書いた決まった文字）", 1],
      ["関数の外の変数 int count = 10;", 2],
      ["関数の外の変数 int total;（値を書いていない）", 3],
      ["malloc(100) で借りた100バイト", 4],
      ["関数の中の変数 int i;", 5],
      ["関数を呼んだときの戻り先", 5]
    ];
    var sel = [];
    root.innerHTML = head("どの区画に置かれる？") + '<div class="lay"></div><p class="lab-status" aria-live="polite"></p>';
    var box = root.querySelector(".lay");
    ITEMS.forEach(function (it, i) {
      var row = document.createElement("div");
      row.className = "lay-row";
      row.innerHTML = '<span class="lay-q">' + it[0] + '</span><select aria-label="' + it[0] + ' の区画"><option value="">― 選ぶ ―</option>' +
        REG.map(function (r, k) { return '<option value="' + k + '">' + r + "</option>"; }).join("") + '</select><span class="lay-mark"></span>';
      row.querySelector("select").addEventListener("change", function (e) { sel[i] = e.target.value === "" ? null : +e.target.value; check(); });
      box.appendChild(row);
    });
    function check() {
      var right = 0;
      box.querySelectorAll(".lay-row").forEach(function (row, i) {
        var m = row.querySelector(".lay-mark");
        if (sel[i] === undefined || sel[i] === null) { m.textContent = ""; row.className = "lay-row"; return; }
        var ok = sel[i] === ITEMS[i][1];
        if (ok) right++;
        m.textContent = ok ? "✓" : "✗";
        row.className = "lay-row " + (ok ? "ok" : "ng");
      });
      if (right === ITEMS.length) done(root, "全部正解！");
      else status(root, "正解 " + right + " / " + ITEMS.length);
    }
    if (already) {
      box.querySelectorAll("select").forEach(function (s, i) { s.value = ITEMS[i][1]; sel[i] = ITEMS[i][1]; });
      check();
    } else status(root, "それぞれの区画を選ぼう");
  }

  /* ---------- 9. メモリのバグ ---------- */
  function bugs(root) {
    var already = prepTask(root);
    var CASES = {
      dangling: {
        name: "解放した後に使う",
        code: ["int *p = malloc(4);", "*p = 42;", "free(p);", "int *q = malloc(4);", "*q = 99;", "printf(\"%d\", *p);"],
        steps: [
          [0, [["p", "使用中", "?"]], "4バイトを借りて、その番地を p にしまう。"],
          [1, [["p", "使用中", "42"]], "p の指す先に 42 を書く。"],
          [2, [["p", "返却済み", "42"]], "free で返した。でも p には番地が残ったまま（宙ぶらりんのポインタ）。"],
          [3, [["p と q", "使用中", "42"]], "次に借りた q に、同じ場所が貸し出された。p と q が同じ場所を指している。"],
          [4, [["p と q", "使用中", "99"]], "q の指す先に 99 を書く。"],
          [5, [["p と q", "使用中", "99"]], "p を通して読むと、42 ではなく 99。別のデータを読み書きしてしまう。"]
        ]
      },
      overflow: {
        name: "配列の外に書く",
        code: ["char name[4];", "int ok = 0;", "strcpy(name, \"ABCDEFG\");", "if (ok) { 管理者として入れる }"],
        steps: [
          [0, [["name[0..3]", "", "? ? ? ?"], ["ok", "", "0"]], "4文字分の箱 name の、すぐ後ろに ok が置かれている。"],
          [1, [["name[0..3]", "", "? ? ? ?"], ["ok", "", "0"]], "ok は 0（入れない）。"],
          [2, [["name[0..3]", "", "A B C D"], ["ok", "あふれ", "E F G"]], "7文字＋終わりの印を、4文字の箱に書き込んだ。はみ出した分が隣の ok を上書きした。"],
          [3, [["name[0..3]", "", "A B C D"], ["ok", "あふれ", "0 ではない"]], "ok が 0 でなくなったので、入れてしまう。入力の長さを確かめなかったことが、そのまま穴になる。"]
        ]
      },
      double: {
        name: "2回返す",
        code: ["char *a = malloc(8);", "free(a);", "free(a);"],
        steps: [
          [0, [["a", "使用中", ""]], "8バイトを借りた。"],
          [1, [["a", "返却済み", ""]], "返した。この場所は空きの名簿に載る。"],
          [2, [["a", "名簿が壊れる", ""]], "同じ場所をもう一度返すと、空きの名簿に同じ場所が2回載る。あとで2人に同じ場所を貸してしまう原因になる。"]
        ]
      }
    };
    var seen = {};
    var cur = "dangling", k = 0;
    root.innerHTML = head("3つの典型的なバグ") +
      '<div class="row tabs"></div>' +
      '<div class="row"><button type="button" class="btn btn-primary lab-step">1行すすめる</button><button type="button" class="btn lab-reset">最初から</button></div>' +
      '<div class="stack-wrap"><pre class="code"></pre><div><h4>メモリ</h4><div class="bugmem"></div></div></div><p class="lab-status" aria-live="polite"></p>';
    var tabs = root.querySelector(".tabs");
    Object.keys(CASES).forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn"; b.textContent = CASES[c].name; b.setAttribute("data-c", c);
      b.addEventListener("click", function () { cur = c; k = 0; draw(); });
      tabs.appendChild(b);
    });
    function draw() {
      var C = CASES[cur], s = C.steps[k];
      tabs.querySelectorAll("button").forEach(function (b) { b.classList.toggle("btn-primary", b.getAttribute("data-c") === cur); });
      root.querySelector(".code").innerHTML = C.code.map(function (l, i) { return '<span class="' + (i === s[0] ? "cur" : "") + '">' + l.replace(/</g, "&lt;") + "</span>"; }).join("\n");
      root.querySelector(".bugmem").innerHTML = s[1].map(function (r) {
        var bad = /返却|あふれ|壊れ/.test(r[1]);
        return '<div class="fvar' + (bad ? " bad" : "") + '"><span>' + r[0] + "</span><em>" + r[1] + "</em><b>" + r[2] + "</b></div>";
      }).join("");
      if (k === C.steps.length - 1) seen[cur] = true;
      var all = Object.keys(CASES).every(function (c) { return seen[c]; });
      if (all || already) done(root, s[2]);
      else status(root, s[2] + (k === C.steps.length - 1 ? "（ほかのバグも見てみよう）" : ""));
    }
    root.querySelector(".lab-step").addEventListener("click", function () { if (k < CASES[cur].steps.length - 1) { k++; draw(); } });
    root.querySelector(".lab-reset").addEventListener("click", function () { k = 0; draw(); });
    draw();
  }

  /* ---------- 10. 仮想メモリ（ページ表での変換） ---------- */
  function vmem(root) {
    var already = prepTask(root);
    var PAGE = 16;
    var TABLE = { A: [5, 2, 7, null], B: [1, 6, 3, 0] };
    var seen = {};
    root.innerHTML = head("仮想番地を物理番地に変換する") +
      '<div class="row"><label>プログラム <select class="v-proc"><option>A</option><option>B</option></select></label>' +
      '<label>仮想番地 <select class="v-addr"></select></label><button type="button" class="btn btn-primary lab-go">変換する</button></div>' +
      '<div class="vm-tables"></div><div class="cpu-log vm-log" aria-live="polite"></div><p class="lab-status"></p>';
    var addrSel = root.querySelector(".v-addr");
    [0x05, 0x13, 0x25, 0x2C, 0x31].forEach(function (a) { addrSel.insertAdjacentHTML("beforeend", '<option value="' + a + '">' + hex(a) + "</option>"); });
    addrSel.value = String(0x25);
    function tables(hl) {
      root.querySelector(".vm-tables").innerHTML = ["A", "B"].map(function (p) {
        return '<div class="cpu-box"><h4>プログラム ' + p + " のページ表</h4><table>" +
          TABLE[p].map(function (f, i) {
            return '<tr class="' + (hl && hl[0] === p && hl[1] === i ? "hl" : "") + '"><td>仮想ページ ' + i + "（" + hex(i * PAGE) + "〜）</td><td>→ " + (f === null ? "（割り当てなし）" : "物理フレーム " + f) + "</td></tr>";
          }).join("") + "</table></div>";
      }).join("");
    }
    root.querySelector(".lab-go").addEventListener("click", function () {
      var p = root.querySelector(".v-proc").value, a = +addrSel.value;
      var page = Math.floor(a / PAGE), off = a % PAGE, f = TABLE[p][page];
      tables([p, page]);
      var log = "仮想番地 " + hex(a) + " ＝ ページ番号 " + page + "（" + hex(a) + " ÷ 16 の商）＋ ページ内の位置 " + off + "（余り）。<br>";
      if (f === null) log += "ページ表に割り当てが無い → CPU が止めて OS に知らせる（ページフォールト）。プログラムがおかしな番地を使っていれば強制終了になる。";
      else log += "ページ表で ページ " + page + " → 物理フレーム " + f + "。物理番地 ＝ " + f + " × 16 ＋ " + off + " ＝ <b>" + hex(f * PAGE + off) + "</b>";
      root.querySelector(".vm-log").innerHTML = log;
      if (a === 0x25 && f !== null) seen[p] = true;
      if ((seen.A && seen.B) || already) done(root, "同じ仮想番地 0x25 でも、A と B では別の物理番地に行き着いた。だからお互いのデータを壊せない。");
      else status(root, "仮想番地 0x25 を、プログラム A と B の両方で変換してみよう。");
    });
    tables(null);
    if (already) done(root, "この課題は達成済み");
    else status(root, "仮想番地 0x25 を、プログラム A と B の両方で変換してみよう。");
  }

  var KINDS = { ram: ram, cpu: cpu, cache: cache, stack: stack, heap: heap, pointer: pointer, gc: gc, layout: layout, bugs: bugs, vmem: vmem };
  function boot() {
    document.querySelectorAll(".lab[data-lab]").forEach(function (root) {
      var f = KINDS[root.getAttribute("data-lab")];
      if (f) f(root);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window);
