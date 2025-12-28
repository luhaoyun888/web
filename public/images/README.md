# 图片资源说明

本目录用于存放项目的所有本地图片资源。

## 目录结构

```
images/
├── 360/              # 360° 旋转序列图片
├── cars/             # 汽车模型对比图
├── workflow/         # 工作流程图片
├── ai-lab/          # AI 实验室图片
├── archives/        # 存档图片
├── projects/        # 项目缩略图
└── profile/         # 个人头像
```

## 需要准备的图片文件清单

### 1. 360° 旋转序列 (36 张)

#### `/images/360/` 目录
- `01.png` ~ `36.png` (36 张，带前导零的两位数格式)
  - 用于 ImageSequencePlayer 组件（36 张）
  - 用于 Viewer360 组件（循环使用 36 张，共 60 帧）
  - 建议尺寸: 1200x800

### 2. 汽车模型对比图 (12 张)

#### `/images/cars/` 目录
- `cyber_raw.jpg`, `cyber_final.jpg`
- `lunar_raw.jpg`, `lunar_final.jpg`
- `neon_raw.jpg`, `neon_final.jpg`
- `gt_raw.jpg`, `gt_final.jpg`
- `suv_raw.jpg`, `suv_final.jpg`
- `sport_raw.jpg`, `sport_final.jpg`
- 建议尺寸: 1200x675

### 3. 工作流程图片 (5 张)

#### `/images/workflow/` 目录
- `ta1.jpg` ~ `ta5.jpg`
- 建议尺寸: 300x200

### 4. AI 实验室图片 (12 张)

#### `/images/ai-lab/` 目录
- `flux1.jpg` ~ `flux6.jpg` (缩略图)
  - 建议尺寸: 800x800
  
- `node1.jpg` ~ `node6.jpg` (节点图)
  - 建议尺寸: 1000x600

### 5. 存档图片 (15 张)

#### `/images/archives/` 目录
- `sketch1.jpg` ~ `sketch6.jpg` (早期写生)
  - 建议尺寸: 400x400-700
  
- `ui1.jpg` ~ `ui4.jpg` (UI 原型探索)
  - 建议尺寸: 400x300-600
  
- `vc1.jpg` ~ `vc5.jpg` (视觉传达项目)
  - 建议尺寸: 400x350-700

### 6. 项目缩略图 (3 张)

#### `/images/projects/` 目录
- `car1.jpg`
- `ai1.jpg`
- `dev1.jpg`
- 建议尺寸: 1200x800

### 7. 个人头像 (1 张)

#### `/images/profile/` 目录
- `alex.jpg`
- 建议尺寸: 300x300

## 总计

**共需要 84 张图片文件**（360° 序列使用 36 张 PNG 图片）

## 注意事项

1. 所有图片文件请使用 `.jpg` 格式
2. 文件名必须与上述清单完全一致（区分大小写）
3. 建议使用压缩后的图片以优化加载速度
4. 360° 序列图片建议按顺序命名，确保旋转动画流畅

## 图片准备完成后

1. 将所有图片文件放置到对应的目录中
2. 运行 `npm run dev` 启动开发服务器
3. 检查浏览器控制台是否有图片加载错误
4. 测试所有页面的图片显示是否正常

