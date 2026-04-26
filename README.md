所有代码为Codex编写，仅通过个人测试，不会进行维护。
运行环境为Ableton Live 12.1.11 + Max 8.6.5

# 以下为Codex原README.md

## 功能

- 一键导出当前工程里所有 MIDI 轨道上的 MIDI clip
- 输出为一个标准多轨 `.mid` 文件
- Arrangement clip 保留原始时间位置
- Take Lane 里的 MIDI clip 也会纳入导出
- Session clip 会按轨道内 slot 顺序追加到该轨 Arrangement 内容之后

## 使用

1. 保持这三个文件在同一个文件夹中
2. 优先尝试把 `MidiExport.amxd` 拖进 Live 的 MIDI track
3. 如果你更想自己保存设备，就在 Max 中打开 `LiveSetMidiExporter_v2.maxpat`
4. 点击设备上的 `Export MIDI`
5. 选择输出路径，设备会生成多轨 `.mid`

## 导出规则

- 每条 Ableton Track 导出成一个 MIDI track
- 只导出 MIDI note，不导出自动化、设备参数、音色或 groove
- 对 looped clip，会按可播放区段展开，而不是直接照抄原始 note 存储区
- muted note 不导出

## 说明

这一版是按 Live 12 的 `Track.arrangement_clips`、`Track.take_lanes` 和 `Clip.get_all_notes_extended` 重写的。
