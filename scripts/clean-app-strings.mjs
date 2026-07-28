import fs from 'fs';

const zhList = fs.readFileSync('scripts/zh-strings.txt', 'utf8').trim().split('\n').filter((s) => {
  if (s.length > 90) return false;
  if (/[\n\r<>]/.test(s)) return false;
  if (!/[\u4e00-\u9fff]/.test(s)) return false;
  return true;
});

fs.writeFileSync('scripts/zh-strings.txt', zhList.join('\n'));
console.log('cleaned to', zhList.length);
