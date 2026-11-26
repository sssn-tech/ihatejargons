<!--
{
  "id": "web-speech-dialect-actor",
  "title": "浏览器插件排查忽然切换方言和主语",
  "origin": "web",
  "source_url": "https://linux.do/t/topic/2144374",
  "source_excerpt": "俺",
  "source": "发帖人说 Codex 在分析 Chrome 插件时突然改口自称“俺”，觉得技术分析一下子变成了方言表演。",
  "adaptation": "以下前端开发场景为评测改编。",
  "kind": "summary",
  "question": "工具栏图标是用户自己关掉的吗？",
  "patterns": [
    "P2",
    "P8"
  ],
  "facts": [
    { "id": "f1", "text": "说话者主动在预览版窄屏隐藏了图标，并未修改用户开关。", "critical": true },
    { "id": "f2", "text": "用户截图来自宽屏，按已知改动图标应显示。", "critical": true },
    { "id": "f3", "text": "宽屏问题尚未复现，没有依据更改用户偏好。", "critical": true }
  ],
  "traps": [
    { "id": "t1", "text": "把隐藏图标归咎于用户关了开关。" },
    { "id": "t2", "text": "说宽屏图标消失的原因已查明或已修。" }
  ],
  "jargon": [
    { "term": "俺", "plain": "指进行改动的助手" },
    { "term": "接半口", "plain": "只能解释其中一种屏幕宽度下的行为" }
  ],
  "questions": [
    { "id": "q1", "q": "谁隐藏了哪种屏幕上的图标？", "a": "助手改了预览版窄屏；用户截图里的宽屏现象仍未复现。" }
  ]
}
-->

这锅俺先接半口。俺在预览版把窄屏那颗图标给藏了，省位置；用户那边的开关俺没碰。你截图那台是宽屏，照俺这条改动它该露脸。宽屏那茬俺手上没复现，先别把用户偏好给人掰回去。
