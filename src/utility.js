
export class ErrorMessage extends Error { };

export function makeClassName(...arg) {
  let list = [];
  for (let a of arg) {
    if (!a) continue;
    if (Array.isArray(a)) {
      list = list.concat(a);
    } else if (typeof a === 'object') {
      for (let name in a) {
        if (a[name]) list.push(name);
      }
    } else {
      list.push(a);
    }
  }
  return list.join(' ');
}

export function copyText(text) {
  var textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function saveTextAsFile(filename, text) {
  var blob = new Blob([text]);
  var url = URL.createObjectURL(blob, { type: 'text/plain' });
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
