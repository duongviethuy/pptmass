/**
 * Các hàm tiện ích thao tác trực tiếp trên DOM `contentEditable` của khung nội dung slide:
 * - Đọc văn bản thuần + vùng chọn [start, end] (bỏ qua tiền tố ĐK:/1./2. và thẻ <br> giữ chỗ).
 * - Đặt lại con trỏ văn bản chính xác sau reflow 2 chiều.
 * - Đồng bộ cây DOM giữ nguyên 100% căn đều (justify) và bảo vệ tiền tố số câu hát không bị xóa.
 */

export function readEditableBodyState(root: HTMLElement): { text: string; start: number; end: number } {
  const selection = window.getSelection();
  const range =
    selection && selection.rangeCount > 0 && root.contains(selection.anchorNode) ? selection.getRangeAt(0) : null;

  let text = "";
  let start: number | null = null;
  let end: number | null = null;

  const isPrefixEl = (node: Node) =>
    node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset.slidePrefix === "true";
  const isSentinelBr = (node: Node) =>
    node.nodeType === Node.ELEMENT_NODE &&
    node.nodeName === "BR" &&
    (node as HTMLElement).dataset.sentinel === "true";

  const walk = (parent: Node) => {
    const children = parent.childNodes;
    for (let i = 0; i <= children.length; i += 1) {
      if (range) {
        if (range.startContainer === parent && range.startOffset === i && start === null) {
          start = text.length;
        }
        if (range.endContainer === parent && range.endOffset === i && end === null) {
          end = text.length;
        }
      }
      if (i === children.length) break;

      const child = children[i];
      if (isPrefixEl(child) || isSentinelBr(child)) {
        continue;
      }

      if (child.nodeType === Node.TEXT_NODE) {
        const data = (child as Text).data;
        if (range) {
          if (range.startContainer === child) {
            start = text.length + range.startOffset;
          }
          if (range.endContainer === child) {
            end = text.length + range.endOffset;
          }
        }
        text += data;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.nodeName;
        if (tag === "BR") {
          text += "\n";
        } else {
          if ((tag === "DIV" || tag === "P") && text.length > 0 && !text.endsWith("\n")) {
            text += "\n";
          }
          walk(child);
        }
      }
    }
  };

  walk(root);
  const normalized = text.replace(/\r\n/g, "\n");
  const clampedStart = Math.min(Math.max(0, start ?? normalized.length), normalized.length);
  const clampedEnd = Math.min(Math.max(clampedStart, end ?? clampedStart), normalized.length);
  return { text: normalized, start: clampedStart, end: clampedEnd };
}

export function setEditableCaret(root: HTMLElement, offset: number) {
  let targetTextNode: Text | null = null;
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).dataset.slidePrefix === "true") {
      continue;
    }
    if (child.nodeType === Node.TEXT_NODE) {
      targetTextNode = child as Text;
      break;
    }
  }
  if (!targetTextNode) {
    targetTextNode = document.createTextNode("");
    const sentinel = root.querySelector('br[data-sentinel="true"]');
    if (sentinel) {
      root.insertBefore(targetTextNode, sentinel);
    } else {
      root.appendChild(targetTextNode);
    }
  }

  const selection = window.getSelection();
  if (!selection) return;
  const clamped = Math.min(Math.max(0, offset), targetTextNode.data.length);
  const range = document.createRange();
  range.setStart(targetTextNode, clamped);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function syncEditableBodyDom(
  root: HTMLElement,
  text: string,
  prefix: string | undefined,
  prefixClassName: string,
  prefixColor: string | undefined,
): boolean {
  const needsSentinel = text.length === 0 || text.endsWith("\n");
  const expectedPrefixText = prefix ? `${prefix} ` : null;
  const children = Array.from(root.childNodes);

  let idx = 0;
  let matches = true;

  if (expectedPrefixText) {
    const first = children[idx];
    if (
      !first ||
      first.nodeType !== Node.ELEMENT_NODE ||
      (first as HTMLElement).dataset.slidePrefix !== "true" ||
      first.textContent !== expectedPrefixText ||
      (first as HTMLElement).className !== prefixClassName ||
      ((first as HTMLElement).dataset.prefixColor ?? "") !== (prefixColor ?? "")
    ) {
      matches = false;
    }
    idx += 1;
  }

  if (matches) {
    const textNode = children[idx];
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE || (textNode as Text).data !== text) {
      matches = false;
    }
    idx += 1;
  }

  if (matches && needsSentinel) {
    const sentinel = children[idx];
    if (
      !sentinel ||
      sentinel.nodeType !== Node.ELEMENT_NODE ||
      sentinel.nodeName !== "BR" ||
      (sentinel as HTMLElement).dataset.sentinel !== "true"
    ) {
      matches = false;
    }
    idx += 1;
  }

  if (matches && idx === children.length) {
    return false;
  }

  const nextNodes: Node[] = [];
  if (expectedPrefixText) {
    const span = document.createElement("span");
    span.dataset.slidePrefix = "true";
    if (prefixColor) span.dataset.prefixColor = prefixColor;
    span.contentEditable = "false";
    span.className = prefixClassName;
    if (prefixColor) {
      span.style.color = prefixColor;
    }
    span.textContent = expectedPrefixText;
    nextNodes.push(span);
  }
  nextNodes.push(document.createTextNode(text));
  if (needsSentinel) {
    const br = document.createElement("br");
    br.dataset.sentinel = "true";
    nextNodes.push(br);
  }
  root.replaceChildren(...nextNodes);
  return true;
}
