'use strict';

// Coordinates use a fixed page size so rotating or resizing never moves ink.
const Handwriting = (() => {
  const width = 1000;
  const height = 600;
  function empty() {
    return {version: 1, strokes: []};
  }

  function validate(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.strokes)) return false;
    return value.strokes.every(stroke =>
      stroke && ['pen', 'eraser'].includes(stroke.tool) &&
      /^#[0-9a-f]{6}$/i.test(stroke.color) &&
      Number.isFinite(stroke.size) && stroke.size >= 1 && stroke.size <= 80 &&
      Array.isArray(stroke.points) && stroke.points.length > 0 &&
      stroke.points.every(point => Array.isArray(point) && point.length === 2 &&
        Number.isFinite(point[0]) && point[0] >= 0 && point[0] <= width &&
        Number.isFinite(point[1]) && point[1] >= 0 && point[1] <= height)
    );
  }

  function mount(container, drawing, changed) {
    const toolbar = document.createElement('div');
    toolbar.className = 'tools ink-tools';
    const canvas = document.createElement('canvas');
    canvas.className = 'ink-canvas';
    canvas.setAttribute('aria-label', 'El yazısı ve çizim alanı');
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Apple Pencil ile yaz. Sayfayı kaydırmak için alanın dışını kullan.';
    container.append(toolbar, canvas, hint);
    const context = canvas.getContext('2d');
    let tool = 'pen';
    let pointer = null;
    let active = null;
    let redoStack = [];

    function button(text, action) {
      const element = document.createElement('button');
      element.textContent = text;
      element.onclick = action;
      toolbar.append(element);
      return element;
    }
    function choose(next) {
      finish();
      tool = next;
      pen.setAttribute('aria-pressed', String(tool === 'pen'));
      eraser.setAttribute('aria-pressed', String(tool === 'eraser'));
    }
    const pen = button('Kalem', () => choose('pen'));
    const eraser = button('Silgi', () => choose('eraser'));

    const colorLabel = document.createElement('label');
    colorLabel.textContent = 'Renk ';
    const color = document.createElement('input');
    color.type = 'color';
    color.value = '#355747';
    colorLabel.append(color);
    toolbar.append(colorLabel);

    const sizeLabel = document.createElement('label');
    sizeLabel.textContent = 'Kalınlık ';
    const size = document.createElement('select');
    for (const [value, name] of [[2, 'İnce'], [4, 'Orta'], [8, 'Kalın']]) {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = name;
      size.append(option);
    }
    size.value = '4';
    sizeLabel.append(size);
    toolbar.append(sizeLabel);

    const fingerLabel = document.createElement('label');
    const finger = document.createElement('input');
    finger.type = 'checkbox';
    fingerLabel.append(finger, document.createTextNode(' Parmakla çiz'));
    toolbar.append(fingerLabel);

    const undo = button('↶ Geri al', () => {
      finish();
      if (!drawing.strokes.length) return;
      redoStack.push(drawing.strokes.pop());
      redraw();
      updateButtons();
      changed();
    });
    const redo = button('↷ Yinele', () => {
      finish();
      if (!redoStack.length) return;
      drawing.strokes.push(redoStack.pop());
      redraw();
      updateButtons();
      changed();
    });
    function updateButtons() {
      undo.disabled = !drawing.strokes.length && !active;
      redo.disabled = !redoStack.length;
    }
    function paint(stroke) {
      context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
      context.strokeStyle = stroke.color;
      context.fillStyle = stroke.color;
      context.lineWidth = stroke.size;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      const [first, ...rest] = stroke.points;
      context.beginPath();
      if (!rest.length) {
        context.arc(first[0], first[1], stroke.size / 2, 0, Math.PI * 2);
        context.fill();
      } else {
        context.moveTo(...first);
        for (const point of rest) context.lineTo(...point);
        context.stroke();
      }
    }
    function redraw() {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      for (const stroke of drawing.strokes) paint(stroke);
      if (active) paint(active);
      context.globalCompositeOperation = 'source-over';
    }
    function resize() {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      redraw();
    }
    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return [
        Math.max(0, Math.min(width, (event.clientX - rect.left) * width / rect.width)),
        Math.max(0, Math.min(height, (event.clientY - rect.top) * height / rect.height))
      ];
    }
    function finish() {
      if (!active) return;
      drawing.strokes.push(active);
      active = null;
      const captured = pointer;
      pointer = null;
      redoStack = [];
      if (canvas.hasPointerCapture(captured)) canvas.releasePointerCapture(captured);
      updateButtons();
      changed();
    }
    canvas.onpointerdown = event => {
      if (pointer !== null || event.button !== 0 || (event.pointerType === 'touch' && !finger.checked)) return;
      event.preventDefault();
      pointer = event.pointerId;
      active = {tool, color: color.value, size: Number(size.value) * (tool === 'eraser' ? 5 : 1), points: [point(event)]};
      canvas.setPointerCapture(pointer);
      redraw();
      updateButtons();
    };
    canvas.onpointermove = event => {
      if (event.pointerId !== pointer || !active) return;
      event.preventDefault();
      const events = event.getCoalescedEvents?.() || [];
      for (const sample of events.length ? events : [event]) active.points.push(point(sample));
      redraw();
    };
    canvas.onpointerup = event => {
      if (event.pointerId !== pointer) return;
      active.points.push(point(event));
      finish();
      redraw();
    };
    canvas.onpointercancel = canvas.onlostpointercapture = event => {
      if (event.pointerId === pointer) finish();
    };
    const hide = () => { if (document.hidden) finish(); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', finish);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    choose('pen');
    updateButtons();
    resize();
    return () => {
      finish();
      observer.disconnect();
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', finish);
    };
  }
  return {empty, validate, mount};
})();
