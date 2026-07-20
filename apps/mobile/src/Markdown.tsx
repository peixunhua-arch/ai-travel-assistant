// 一个「够用就好」的 Markdown 渲染器：不引第三方库，自己按行解析。
//
// 为什么自己写？AI 的回复其实是 Markdown 文本（带 # 标题、**加粗**、- 要点、表格），
// 直接用 <Text> 显示会把这些符号原样打出来，很难看。市面上的 markdown 库要么很久没更新、
// 对 React 19 支持存疑，要么会拖进一大坨看不懂的依赖。这个项目是练手用的，
// 自己写一个小的、每行都能看懂的版本更合适，也不怕它在手机上突然崩。
//
// 支持：# 标题、**加粗**、`代码`、[文字](链接)、- / * 无序列表、1. 有序列表、简单表格。
// 不支持（阶段 1 先不做）：嵌套列表、图片、引用块、代码块高亮 —— 以后需要再加。
import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { View, Text, StyleSheet, Linking, Platform } from 'react-native';
import { colors, font } from './theme';

// ---------- 行内解析：把一行里的 **加粗** / `代码` / [文字](链接) 拆成带样式的片段 ----------
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // 一个正则同时匹配三种：加粗、行内代码、链接
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = regex.exec(text)) !== null) {
    // 匹配点之前的普通文字
    if (m.index > lastIndex) {
      parts.push(<Fragment key={`${keyPrefix}-t${i}`}>{text.slice(lastIndex, m.index)}</Fragment>);
    }
    if (m[2] !== undefined) {
      // **加粗**
      parts.push(
        <Text key={`${keyPrefix}-b${i}`} style={styles.bold}>
          {m[2]}
        </Text>,
      );
    } else if (m[3] !== undefined) {
      // `行内代码`
      parts.push(
        <Text key={`${keyPrefix}-c${i}`} style={styles.code}>
          {m[3]}
        </Text>,
      );
    } else if (m[4] !== undefined && m[5] !== undefined) {
      // [文字](链接) —— 点一下用系统浏览器打开
      const url = m[5];
      parts.push(
        <Text key={`${keyPrefix}-l${i}`} style={styles.link} onPress={() => Linking.openURL(url)}>
          {m[4]}
        </Text>,
      );
    }
    lastIndex = m.index + m[0].length;
    i++;
  }
  // 结尾剩下的普通文字
  if (lastIndex < text.length) {
    parts.push(<Fragment key={`${keyPrefix}-t${i}`}>{text.slice(lastIndex)}</Fragment>);
  }
  return parts;
}

// ---------- 表格：把连续的 | a | b | 行渲染成简单网格 ----------
function TableBlock({ lines, keyPrefix }: { lines: string[]; keyPrefix: string }) {
  const rows = lines
    // 跳过 |---|:--:| 这种「分隔行」，它只是画线用的，没内容
    .filter((l) => !/^\|?[\s:|-]+\|?$/.test(l))
    .map((l) =>
      l
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim()),
    );
  if (rows.length === 0) return null;

  return (
    <View style={styles.table}>
      {rows.map((cells, r) => (
        <View key={`${keyPrefix}-r${r}`} style={[styles.tableRow, r === 0 && styles.tableHeaderRow]}>
          {cells.map((c, ci) => (
            <Text
              key={`${keyPrefix}-r${r}c${ci}`}
              style={[styles.tableCell, r === 0 && styles.tableHeaderCell]}
            >
              {renderInline(c, `${keyPrefix}-r${r}c${ci}`)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

// ---------- 主组件：把整段文本按行拆成一个个「块」 ----------
export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    // 空行 → 加一点竖向间距
    if (line === '') {
      blocks.push(<View key={`sp-${key++}`} style={styles.gap} />);
      i++;
      continue;
    }

    // 表格：连续以 | 开头的行，一起收集起来交给 TableBlock
    if (line.startsWith('|') && line.includes('|', 1)) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      blocks.push(<TableBlock key={`tb-${key++}`} lines={tableLines} keyPrefix={`tb${key}`} />);
      continue;
    }

    // 标题 # / ## / ###
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const sizeStyle = level <= 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3;
      blocks.push(
        <Text key={`h-${key++}`} style={[styles.heading, sizeStyle]}>
          {renderInline(h[2], `h${key}`)}
        </Text>,
      );
      i++;
      continue;
    }

    // 无序列表 - / * / •
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    if (ul) {
      blocks.push(
        <View key={`ul-${key++}`} style={styles.listRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.listText}>{renderInline(ul[1], `ul${key}`)}</Text>
        </View>,
      );
      i++;
      continue;
    }

    // 有序列表 1. 2. 3.
    const ol = /^(\d+)\.\s+(.*)$/.exec(line);
    if (ol) {
      blocks.push(
        <View key={`ol-${key++}`} style={styles.listRow}>
          <Text style={styles.bullet}>{ol[1]}.</Text>
          <Text style={styles.listText}>{renderInline(ol[2], `ol${key}`)}</Text>
        </View>,
      );
      i++;
      continue;
    }

    // 其它都当普通段落
    blocks.push(
      <Text key={`p-${key++}`} style={styles.paragraph}>
        {renderInline(line, `p${key}`)}
      </Text>,
    );
    i++;
  }

  return <View>{blocks}</View>;
}

const monospace = Platform.select({ ios: 'Menlo', default: 'monospace' });

const styles = StyleSheet.create({
  paragraph: { color: colors.textPrimary, fontSize: font.body.size, lineHeight: font.body.lineHeight },
  gap: { height: 6 },
  heading: { color: colors.textStrong, fontWeight: '700', marginTop: 2, marginBottom: 2 },
  h1: { fontSize: 18, lineHeight: 24 },
  h2: { fontSize: 16.5, lineHeight: 23 },
  h3: { fontSize: 15.5, lineHeight: 22 },
  bold: { fontWeight: '700' },
  code: {
    fontFamily: monospace,
    fontSize: 14,
    backgroundColor: colors.accentLight,
    color: colors.accentDark,
  },
  link: { color: colors.primary, textDecorationLine: 'underline' },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 1 },
  bullet: {
    width: 20,
    color: colors.textPrimary,
    fontSize: font.body.size,
    lineHeight: font.body.lineHeight,
    textAlign: 'left',
  },
  listText: { flex: 1, color: colors.textPrimary, fontSize: font.body.size, lineHeight: font.body.lineHeight },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    marginVertical: 4,
    overflow: 'hidden',
  },
  tableRow: { flexDirection: 'row' },
  tableHeaderRow: { backgroundColor: colors.accentLight },
  tableCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  tableHeaderCell: { fontWeight: '700' },
});
