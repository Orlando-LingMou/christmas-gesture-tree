# 圣诞星愿 · A Christmas Constellation

用手势控制的黑金 3D 粒子圣诞树。一次选择或拖入 5–15 张照片，再对着摄像头张开手掌，照片先挂在红绿金配色的圣诞树上并随树转动。张开手掌后，大多数粒子飞向四周，照片向外展开和放大，树形仍可辨认。

| 操作 | 效果 |
| --- | --- |
| 张开手掌 | 散开圣诞树并显示照片 |
| 保持张手，左右或上下移动 | 沿手掌移动方向水平旋转，画面保持居中 |
| 拇指和食指捏合 | 在散开时放大金框标记的照片 |
| 握拳 | 聚合成树 |
| 按「散开粒子」或「聚合成树」 | 用按钮切换形态 |
| 鼠标或手指拖动画面 | 旋转场景 |
| 点击浮动照片或缩略图 | 放大照片 |
| 点画面右下角图标 | 开启或退出沉浸模式 |
| 生成圣诞树 | 进入带极光、繁星和蓝白光雨的居中展示，祝福与名字分为两行。张手或点击空白处，祝福化作金色粒子，再在树后放大浮现。按 Esc 或点击右上角返回编辑 |

## 本地运行

需要 Node.js 20.19+ 或 22.12+。

```sh
npm ci
npm run dev
```

打开终端显示的 localhost 地址。开启摄像头后，将一只手完整放在摄像头前，保持张手并移动。网页只显示识别状态，摄像头画面在浏览器内后台处理。Chrome、Edge 或 Safari 的近期版本均可尝试。摄像头需要 HTTPS 或 localhost。第一次开启手势需要联网下载 MediaPipe 的手部模型。

## 部署

运行 `npm run build` 生成 `dist/`。将该目录部署到支持 HTTPS 的静态托管即可。构建使用相对路径，也可以部署到子目录。

## 照片与摄像头

照片在当前页面内存中处理，刷新页面会清除照片。摄像头只在手动开启后工作，实时画面交给浏览器内的 MediaPipe 识别。应用没有照片服务器，也不发送摄像头画面。

## 开源来源

- [Grand Luxury Tree](https://github.com/electronicminer/gesture-Christmas_tree-3d_with_photo) 是最初手势与旋转交互的参考。本项目保留其 [MIT 版权声明](THIRD_PARTY_NOTICES.md)。
- [gemini3-gesture-3d-particle-tree](https://github.com/liutingfenga/gemini3-gesture-3d-particle-tree) 的照片云与手势状态，以及 [digital-christmas-tree](https://github.com/kunkun-778/digital-christmas-tree) 的手势与鼠标操作，作为交互参考。
- 3D 渲染使用 [Three.js](https://threejs.org/)，手势识别使用 [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)。
