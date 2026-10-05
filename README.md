# Nikon Frame

浏览器本地处理照片，固定尼康信息栏模板，支持 EXIF 修正、单张 JPG 与批量 ZIP 导出。

## 本地运行

安装 Node.js 后，在本目录运行 `npm start`，打开 http://127.0.0.1:4173。

运行 `npm test` 验证拍摄信息格式与文件命名。

支持 JPG/JPEG、PNG、WebP。NEF/RAW、HEIC 需先转换。刷新网页会清除导入内容。大批量或超大照片受浏览器内存与画布限制，可分批处理。

导出 JPG 质量 95%，采用浏览器 sRGB 渲染，不复制原始 EXIF 或 GPS。照片像素尺寸保持不变，底部增加信息栏。

模板参考：https://www.icloud.com/shortcuts/d192a2e3647246f79f196df278231493

信息栏素材提取自该指令的原始模板。第三方依赖：exifr 7.1.3（MIT）、fflate 0.8.2（MIT），随站点本地分发。
