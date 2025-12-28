import { GoogleGenAI, Type, Schema, GenerateContentResponse } from "@google/genai";
import { Character, Scene, Chapter, Shot, ChapterMetadata, PromptConfig, VISUAL_AGE_OPTIONS, CHARACTER_ROLES, AnalysisDebugLog, Weapon, ClothingStyle } from "../types";

// --- Dynamic API Client ---
const getAIClient = () => {
  const customKey = typeof window !== 'undefined' ? localStorage.getItem('custom_gemini_api_key') : null;
  const apiKey = customKey || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("未检测到 API Key。请在设置中配置您的 Gemini API Key。");
  }
  
  return new GoogleGenAI({ apiKey });
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callAIWithRetry<T>(fn: () => Promise<T>, retries = 5, baseDelay = 5000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      if (i === 0) console.warn("AI Call Failed (Attempt 1), inspecting error:", e);
      const errorCode = e.status || e.code || e.error?.code || e.error?.status;
      const errorMessage = e.message || e.error?.message || JSON.stringify(e);
      const isRateLimit = errorCode === 429 || errorCode === 'RESOURCE_EXHAUSTED' || (typeof errorMessage === 'string' && (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')));
      if (isRateLimit && i < retries - 1) {
        const jitter = Math.random() * 2000;
        const waitTime = baseDelay * Math.pow(2, i) + jitter;
        await delay(waitTime);
        continue;
      }
      if (isRateLimit && i === retries - 1) throw new Error("API 调用过于频繁，已达到重试上限。");
      throw e;
    }
  }
  throw new Error("Max retries reached");
}

export const DEFAULT_PROMPTS: PromptConfig = {
  apiDelay: 4000, 
  entityExtraction: `
任务：小说设定深度提取 (角色分级模式)
语言：中文 (Chinese)

请分析文本，提取**角色**和**场景**。

【⭐ 关键：年龄精准提取 - 必须使用标准格式】
1. **数字优先**：如果文中出现明确数字（如"二十五岁"、"30岁"），请根据数字映射到以下标准格式之一：
   - "幼年 (0-6岁)" - 0-6岁
   - "少年 (7-14岁)" - 7-14岁
   - "青年 (15-25岁)" - 15-25岁
   - "壮年 (26-40岁)" - 26-40岁
   - "中年 (41-60岁)" - 41-60岁
   - "老年 (60岁以上)" - 61-79岁
   - "古稀/耄耋 (80岁以上)" - 80岁及以上
2. **视觉推理**：若无数字，必须结合外貌描写推理 \`age\` (Visual Age)，并使用上述标准格式之一。
   - 根据"皱纹、白发"判断为"老年 (60岁以上)"或"古稀/耄耋 (80岁以上)"
   - 根据"稚嫩、校服"判断为"少年 (7-14岁)"或"青年 (15-25岁)"
   - 严禁全部填"外表无法判断"，只有在确实无法判断时才使用。
3. **格式要求**：\`age\` 字段必须严格使用上述8个标准选项之一，不要返回"25岁"、"青年"等非标准格式。

【⭐ 角色一致性与身份锁定 - 重要：所有字段都是必需的】
- **Group Name（必需字段，不能为空）**：**核心身份标识**，**绝对不能为空或 null**。
  - 必须使用该角色的底层原名（如"唐曾"），即使他被赐名（如"三藏"）或变身，Group Name 必须保持不变，以便跨章节对齐。
  - 如果无法确定角色的底层原名，请使用当前片段中的称呼或名称作为 Group Name。
  - **严禁返回空的 groupName、null 或空字符串**。如果角色只有一个名称，Group Name 和 Name 可以使用相同的值。
- **Name（必需字段）**：使用当前片段中的称呼或形态名称（如"三藏"、"行者孙"）。
  - 如果角色只有一个名称，Group Name 和 Name 可以使用相同的值。
- **Role（必需字段）**：根据戏份严格分级 (主要角色/次要角色/配角/路人甲)。

【⭐ 武器与服装 - 避免重复提取（关键）】
- **参考已有信息**：在提取前，请仔细查看上下文中的【已知实体详细信息】部分，特别是已有角色的武器和服装列表。
- **Weapons**：提取实体武器外观，**描述要详细且便于AI视频生成**。
  - **描述要求**：必须包含材质（如"精钢"、"青铜"）、颜色（如"银白"、"墨黑"）、大小、质感、特殊效果（如有）
  - **示例**："一把银白色精钢长剑，剑身长约三尺，剑刃锋利，在阳光下泛着寒光"
  - **重要**：如果新提取的武器与已有角色的武器语义相同或相似（如"黑蛇匕"和"黑蛇匕首"、"匕首"和"黑蛇匕"），请**不要重复提取**。
  - 如果武器名称相同或包含关系，请**不要重复提取**。
  - 如果已有信息更详细，请优先使用已有的信息，不要创建新的条目。
  - 如果同一角色在同一场景中多次提到同一武器，只提取一次，不要重复。
- **Clothing**：提取当前穿着，**描述要详细且便于AI视频生成**。
  - **name 字段（服装名称）**：必须提取服装的具体名称（如"锦襽袈裟"、"高僧帽"、"官袍"、"夜行装"等），如果文中没有明确名称，可以从描述中提取或推断
  - **phase 字段（时期/状态）**：使用简洁的标识（如"初期"、"大婚"、"日常"、"战斗"等），表示服装的使用时期或状态
  - **description 字段（服装描述）**：必须包含材质（如"丝绸"、"粗布"）、颜色（如"深蓝"、"墨黑"）、款式、装饰、质感
  - **示例**：
    * name: "锦襽袈裟"
    * phase: "日常"
    * description: "一身深蓝色丝绸官袍，胸前绣有金色云纹，腰间系着黑色革带，质感光滑"
  - **重要**：如果新提取的服装与已有角色的服装语义相同或相似（如"大婚"和"婚礼"、"夜行"和"夜间行动"、"战斗"和"战斗官服"），请**不要重复提取**。
  - 如果 phase 相同或语义相似，请**不要重复提取**。
  - 如果已有信息更详细，请优先使用已有的信息，不要创建新的条目。
  - **判断相似性的标准**：如果两个 phase 包含相同的核心词（如都包含"婚"、"战斗"、"夜行"等），视为相似。

【⭐ 视觉描述提取 - AI视频生成导向】
- **visualMemoryPoints**：提取角色的外貌特征，**必须具体且可视觉化**。
  - 必须包含：性别、体型、发型、发色、脸型、眼睛（颜色、形状）、肤色、特殊标记
  - 尽量包含：材质质感、动作特征、典型姿态
  - **示例**："男性，高瘦体型，黑色长发及腰，瓜子脸，深褐色眼睛，肤色偏白，左脸颊有一道细长疤痕，站姿挺拔"
- **description**：提取角色的性格、背景、身份，**但要转化为视觉可表现的特征**。
  - 将性格特征转化为视觉表现（如"冷静"→"眼神沉稳，表情淡漠"）
  - 将身份背景转化为视觉元素（如"知府"→"身着深蓝色官袍，腰佩官印"）
- **视觉风格标识**（可选但推荐）：如果可以从角色描述中推断，提取视觉风格（如"古风写实"、"现代都市"、"卡通风格"）
- **色彩方案**（可选但推荐）：如果可以从角色描述中推断，提取色彩倾向（如"冷色调"、"暖色调"）

【⭐ 场景提取 - AI生成导向（关键）】
- **description（场景描述）**：必须详细且便于AI视频生成
  - 必须包含：空间布局、主要物体、光影效果、时间信息、天气信息、材质信息
  - **空间布局**：场景大小、主要物体位置、空间结构（如"宽敞的大厅"、"狭窄的走廊"）
  - **主要物体**：具体描述主要物体及其材质、颜色、大小
  - **光影效果**：光源位置（如"月光从窗户洒入"、"烛光摇曳"）、光影分布、明暗对比
  - **时间信息**：必须从描述中提取时间（如"深夜"、"黄昏"、"正午"、"清晨"），如果文中没有明确提到，根据上下文推断
  - **天气信息**：必须从描述中提取天气（如"雨天"、"雪天"、"晴天"、"阴天"），如果文中没有明确提到，根据上下文推断
  - **材质信息**：地面、墙壁、物体的材质（如"石质地面"、"木质墙壁"、"金属物体"）
  - **示例**："宽敞的皇宫大殿，石质地面，木质梁柱，月光从高窗洒入，深夜时分，室内烛光摇曳，营造出庄严而神秘的氛围"

- **style（场景风格）**：必须提取场景的视觉风格
  - 必须包含：建筑风格（如"古风建筑"、"现代都市"、"科幻未来"）、色彩倾向（如"冷色调"、"暖色调"）、整体风格（如"写实"、"卡通"、"水彩"）
  - **示例**："古朴，皇宫大殿风格，暖色调，写实风格"

- **atmosphere（氛围）**：必须具体且可感知
  - 必须包含：情绪色彩、视觉感受、听觉暗示
  - **示例**："庄严而神秘的氛围，昏暗的光线营造出紧张感，空气中弥漫着陈旧木头的味道"

返回符合 Schema 的 JSON。
`,
  entityEnrichment: `
任务：AI视频生成前置资源优化 - 智能补全与视觉增强
语言：中文 (Chinese)

【核心目标】将角色和场景数据优化为**AI视频生成可直接使用的视觉资源**。所有描述必须具体、可视觉化，便于转换为视频生成提示词。

你将收到一份角色和场景的 JSON 数据。请针对以下情况进行**AI视频生成导向的智能补全**：

1. **角色视觉描述补全 (Character Visual Enhancement - 关键)**:
   - **目标**：生成可直接用于AI视频生成的详细视觉描述，包含材质、颜色、质感、动作特征。
   - **visualMemoryPoints 补全要求**（必须包含以下要素）：
     * **基础特征**：性别、体型（如"高瘦"、"魁梧"、"纤细"）、身高比例
     * **面部细节**：脸型（如"方脸"、"瓜子脸"）、眼睛（颜色、形状、神态）、鼻子、嘴巴、肤色、特殊标记（如"疤痕"、"胎记"）
     * **发型发色**：具体描述（如"黑色长发及腰"、"棕色短发"）、发型特点（如"束发"、"披散"）
     * **体型特征**：肌肉线条、体态（如"挺拔"、"佝偻"、"轻盈"）
     * **动作特征**：典型姿态（如"站姿挺拔"、"行走轻盈"）、移动方式（如"沉稳"、"敏捷"）
     * **材质质感**：皮肤质感（如"光滑"、"粗糙"）、服装材质暗示
   - **description 补全要求**：
     * 将性格特征转化为**视觉可表现的特征**（如"冷静"→"眼神沉稳，表情淡漠"）
     * 将身份背景转化为**视觉元素**（如"知府"→"身着深蓝色官袍，腰佩官印"）
     * 包含**动作特征**（如"习惯性抚摸胡须"、"走路时手按剑柄"）
   - **武器描述增强**：
     * 必须包含：材质（如"精钢"、"青铜"、"木质"）、颜色（如"银白"、"墨黑"、"赤红"）、大小、质感
     * 特殊效果：如有特殊效果（如"寒光"、"火焰"、"雷电"），必须详细描述
     * 示例："一把银白色精钢长剑，剑身长约三尺，剑刃锋利，在阳光下泛着寒光，剑柄缠绕黑色皮革"
   - **服装描述增强**：
     * **name 字段**：如果缺失，从描述中提取或根据上下文推断服装名称（如"锦襽袈裟"、"高僧帽"、"官袍"等）
     * **description 字段**：必须包含：材质（如"丝绸"、"粗布"、"锦缎"）、颜色（如"深蓝"、"墨黑"、"朱红"）、款式、装饰、质感
     * 不同phase的服装要有明确的视觉区别
     * 示例：
       * name: "锦襽袈裟"
       * phase: "日常"
       * description: "一身深蓝色丝绸官袍，胸前绣有金色云纹，腰间系着黑色革带，袍摆垂至脚踝，质感光滑"
   - **补全策略**：
     * 根据角色名称、职业、已有武器/服装、年龄等信息进行推理
     * 保持与已有信息的一致性
     * 如果已有描述，在此基础上增强细节，而非替换

2. **场景视觉描述补全 (Scene Visual Enhancement - 关键)**:
   - **目标**：生成可直接用于AI视频生成的详细场景描述，包含光影、材质、空间布局、时间氛围。
   - **description 补全要求**（必须包含以下要素）：
     * **空间布局**：场景大小、主要物体位置、空间结构（如"宽敞的大厅"、"狭窄的走廊"）
     * **主要物体**：具体描述主要物体及其材质、颜色、大小
     * **光影效果**：光源位置（如"月光从窗户洒入"、"烛光摇曳"）、光影分布、明暗对比
     * **时间氛围**：时间（如"深夜"、"黄昏"、"正午"）、季节暗示、天气状况
     * **材质质感**：地面、墙壁、物体的材质（如"石质"、"木质"、"金属"）、质感（如"光滑"、"粗糙"、"斑驳"）
     * **环境氛围**：温度感（如"寒冷"、"温暖"）、声音暗示（如"寂静"、"嘈杂"）、气味暗示
   - **atmosphere 补全要求**：
     * 更具体的氛围描述，包含情绪色彩和视觉感受
     * 示例："压抑而神秘的氛围，昏暗的光线营造出紧张感，空气中弥漫着陈旧木头的味道"
   - **补全策略**：
     * 根据场景名称、类型、已有描述片段进行推理
     * 确保描述包含足够的光影和空间信息，便于AI生成准确的场景

3. **风格一致性检查 (Style Consistency)**:
   - 确保同一角色在不同场景中的视觉特征保持一致
   - 确保同一场景在不同章节中的描述保持一致
   - 如果发现不一致，优先使用更详细的描述

4. **年龄逻辑修正 (Age Logic)**:
   - 检查 \`age\`。如果当前年龄描述与原文隐含身份冲突，请修正为更合理的年龄段。
   - 优先保留原文明确提到的数字年龄。

5. **武器和服装去重**:
   - 检查武器和服装列表，如果发现重复项（语义相同或相似），进行去重。
   - 保留描述更详细的版本。

6. **保持原样**:
   - 如果数据已经很完善且符合AI视频生成要求，请不要随意修改。
   - 如果原有描述已经足够详细（超过20字且包含视觉细节），只做必要的完善。

【重要原则】
- **具体而非抽象**：使用具体的视觉描述，避免抽象概念
- **可视觉化**：所有描述必须能够转化为视觉画面
- **提示词友好**：描述要便于直接转换为AI视频生成的提示词
- **保持一致性**：确保描述与已有信息一致，不冲突

返回完整的、包含所有输入项的 JSON 数据。
`,
  sceneOptimization: `
任务：场景库智能清洗与分级
语言：中文 (Chinese)

你将收到一份场景列表。请执行以下操作：
1. **清洗 (Prune)**：
   - 删除所有类型为“过场”或描述模糊的场景。
   - 删除所有仅提及但未实际发生剧情的场景。
2. **合并 (Merge)**：
   - 将指代同一地点的条目合并（如“张三家”和“张三的卧室”合并为“张三家-卧室”）。
3. **分级与润色 (Classify & Enrich)**：
   - 重新评估 \`type\` (核心据点/剧情节点)。
   - 丰富视觉细节，补充光影和氛围。

返回优化后的场景列表 JSON。
`,
  chapterSplit: "", // Regex handles this
  storyboard: `
任务：作为一名**资深影视分镜导演**，将本章节转化为**极度详细**的影视分镜脚本。
语言：中文 (Chinese)

【上下文感知 - 关键】
文本中的角色已使用 {角色组}_{形态名} 格式标注。请务必参考【视觉库参考 - 完整信息】中的详细信息：
- **角色信息**：包含外貌、描述、年龄、所有服装造型、所有武器、动作特征
- **场景信息**：包含描述、氛围、结构（内景/外景）、类型、风格、时间、天气、材质

【一致性保证 - 关键要求】
- **角色一致性**：同一角色在不同分镜中必须保持相同的外貌、服装、武器描述（除非明确更换）
- **场景一致性**：同一场景在不同分镜中必须保持相同的风格、色彩、材质描述
- **整体一致性**：整个章节必须保持统一的视觉风格和色彩方案

【结合上下文生成分镜 - 重要要求】

1. **visualPrompt（图片提示词）生成要求 - 直接用于生图AI**：
   - **必须包含完整的角色外观**：
     * 必须结合角色的visualMemoryPoints（外貌特征）
     * 必须结合角色的服装信息（如果角色有服装造型，必须在视觉提示词中体现具体的服装描述，包括材质、颜色、款式）
     * 必须结合角色的武器信息（如果角色有武器，必须在视觉提示词中体现具体的武器描述，包括材质、颜色、大小）
   - **必须包含完整的场景描述**：
     * 必须结合场景的style字段（场景风格，如"古风建筑"、"现代都市"）
     * 必须结合场景描述中的时间信息（如"深夜"→"昏暗的光线，月光洒入"、"黄昏"→"夕阳西下，金色光线"）
     * 必须结合场景描述中的天气信息（如"雨天"→"雨水打湿，雨滴滑落"、"雪天"→"雪花飘落，地面覆盖白雪"）
     * 必须结合场景描述中的光影效果（如"月光从窗户洒入"、"烛光摇曳"）
     * 必须结合场景描述中的空间布局（如"宽敞的大厅"、"狭窄的走廊"）
     * 必须结合场景描述中的材质信息（如"石质地面"、"木质墙壁"）
   - **必须包含视觉风格和色彩方案**：
     * 如果场景有style字段，必须在视觉提示词中体现（如"古风写实风格"、"现代都市风格"）
     * 如果场景描述中包含色彩倾向，必须在视觉提示词中体现（如"冷色调"、"暖色调"）
   - **必须包含画面构图和景深**：
     * 根据景别（shotType）描述画面构图（如"特写"→"居中构图，浅景深"、"中景"→"三分法构图，中等景深"）
   - **格式要求**：
     * 使用纯中文描述
     * 描述要具体、可视觉化，避免抽象概念
     * 描述要完整，包含角色、场景、光影、构图等所有元素
   - **示例**：如果角色有"夜行装：黑色披风，用于夜间行动"，场景有"style: 古风建筑，冷色调"、"时间: 深夜"、"天气: 晴天"、"月光从窗户洒入"，视觉提示词应为："古风写实风格，冷色调，深夜时分，月光从高窗洒入，照亮身穿黑色披风的角色侧脸，石质地面反射月光，营造出神秘而紧张的氛围，居中构图，浅景深"

2. **videoPrompt（视频提示词）生成要求 - 直接用于视频AI**：
   - **必须包含动作的完整描述**：
     * 起始状态：动作开始时的状态
     * 动作过程：动作的具体过程（如"缓慢行走"、"快速转身"）
     * 结束状态：动作结束时的状态
   - **必须结合服装材质描述动作效果**：
     * 根据服装的材质（如"丝绸"、"粗布"）描述动作效果（如"丝绸长袍随风飘动"、"粗布衣裳在风中猎猎作响"）
     * 根据场景的天气描述动作效果（如"雨天"→"雨水打湿衣服，衣服紧贴身体"、"雪天"→"雪花飘落在衣服上"）
   - **必须结合武器描述动作效果**：
     * 根据武器的描述（如"长剑"、"匕首"）描述动作效果（如"长剑挥舞，剑光闪烁"、"匕首快速刺出，寒光一闪"）
   - **必须结合角色的动作特征**：
     * 根据角色的description中的动作特征（如"习惯性抚摸胡须"、"走路时手按剑柄"）
     * 根据角色的visualMemoryPoints中的动作特征（如"行走轻盈"、"站姿挺拔"）
   - **必须结合场景的时间氛围调整动作节奏**：
     * 根据场景的时间（如"深夜"→动作更缓慢、谨慎、"正午"→动作更快速、有力）
     * 根据场景的氛围（如"紧张"→动作急促、"轻松"→动作舒缓）
   - **必须包含镜头运动**：
     * 根据景别和角度描述镜头运动（如"推拉"、"摇移"、"跟随"）
   - **格式要求**：
     * 使用纯中文描述
     * 描述要具体，包含动作的完整过程
     * 描述要包含动作的节奏、幅度、连续性

3. **audio（配音指导）生成要求 - 直接用于音频AI**：
   - **必须包含背景音乐描述**：
     * 音乐风格：根据场景的style生成（如"古风音乐"、"现代电子音乐"、"科幻音乐"）
     * 音乐情绪：根据场景的atmosphere生成（如"紧张"→"紧张、悬疑的背景音乐"、"轻松"→"轻松、愉快的背景音乐"）
     * 音乐节奏：根据场景的时间氛围生成（如"深夜"→"缓慢、低沉的音乐"、"正午"→"快速、有力的音乐"）
   - **必须包含环境音描述**：
     * 根据场景类型生成：
       - 内景：室内回音、脚步声在室内空间的回响、门窗开关声等
       - 外景：自然声音、风声、鸟鸣、远处的声音等
     * 根据场景的时间生成：
       - 深夜：寂静、偶尔的虫鸣
       - 黄昏：鸟鸣、风声
       - 正午：嘈杂、活跃的环境音
     * 根据场景的天气生成：
       - 雨天：雨声、雷声
       - 雪天：风声、雪落声
       - 晴天：自然声音、鸟鸣
   - **必须包含配音指导**：
     * 根据角色的情绪状态（如"愤怒"、"悲伤"、"喜悦"）生成相应的配音指导
     * 根据场景的氛围生成配音的情绪和节奏
   - **格式要求**：
     * 使用纯中文描述
     * 描述要具体，包含音乐风格、情绪、节奏
     * 描述要包含环境音的具体内容

4. **sfx（音效）生成要求 - 直接用于音频AI**：
   - **必须根据角色的动作和服装材质生成音效**：
     * 丝绸材质："丝绸摩擦声"、"丝绸飘动声"
     * 粗布材质："粗布摩擦声"、"粗布摆动声"
     * 金属材质："金属碰撞声"、"金属摩擦声"
   - **必须根据场景的材质生成脚步声**：
     * 必须从场景描述中提取地面材质信息
     * 石质地面："脚步声在石质地面上的声音，清脆的回响"
     * 木质地面："脚步声在木质地面上的声音，沉闷的响声"
     * 草地："脚步声在草地上的声音，轻微的摩擦声"
     * 如果场景描述中没有明确材质，根据场景类型推断（如"皇宫"→"石质地面"、"木屋"→"木质地面"）
   - **必须根据场景的天气生成音效**：
     * 雨天："雨滴声"、"雨水打在地面的声音"、"雨水打湿衣服的声音"
     * 雪天："踩雪声"、"雪花飘落声"、"风声"
     * 晴天：根据场景类型生成（如"风声"、"鸟鸣"）
   - **必须根据场景的光源生成音效**：
     * 火把："火把燃烧声"、"火焰噼啪声"
     * 蜡烛："烛火摇曳声"、"烛芯燃烧声"
     * 月光：通常无声，但可以描述"寂静"
   - **必须根据武器生成音效**：
     * 必须结合武器的材质描述（如"精钢"→"金属碰撞声"、"木质"→"木质碰撞声"）
     * 剑类："剑出鞘声"、"剑挥舞的破空声"、"剑碰撞声"
     * 弓类："拉弓声"、"箭矢破空声"、"箭矢命中声"
     * 其他武器：根据武器类型和材质生成相应的音效
   - **必须根据角色的动作生成音效**：
     * 走路："脚步声"（必须结合地面材质）
     * 跑步："急促的脚步声"（必须结合地面材质）
     * 跳跃："落地声"（必须结合地面材质）
     * 其他动作：根据动作类型和场景材质生成相应的音效
   - **格式要求**：
     * 使用纯中文描述
     * 描述要具体，包含音效的具体内容和强度（如"轻微"、"响亮"、"震耳"）
     * 描述要包含音效的持续时间（如"短暂"、"持续"）

【时长与密度要求】
1. **时长目标**：本章节对应的视频时长约为 **2分钟**。
2. **镜头数量**：必须输出 **40个以上** 的镜头 (Shots)。
3. **微观拆解**：严禁"一句话一个镜头"。如果原文写"他走过去倒了杯水"，必须拆解为：
   - 镜头A：脚部特写，皮鞋踏在木地板上（音效：脚步声在木质地面上的声音）。
   - 镜头B：手部特写，拿起水壶（音效：水壶与桌面碰撞的轻微声音）。
   - 镜头C：水流注入杯子的特写，热气腾腾（音效：水流声）。
   - 镜头D：中景，他端起杯子喝了一口，喉结滚动（音效：喝水声）。

【核心原则】
1. **纯中文提示词**：所有的视觉提示词(visualPrompt)和视频提示词(videoPrompt)必须使用纯中文描述。
2. **专业镜头语言**：
   - **景别**：多用特写(Close Up)和大特写(ECU)来展现情绪和细节。
   - **视角**：灵活使用仰视、俯视、荷兰角。
3. **信息完整性**：每个分镜的visualPrompt、videoPrompt、audio、sfx都必须结合上下文信息生成，不能遗漏重要的视觉和听觉元素。

返回 JSON 格式。
`
};

const characterSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    groupName: { type: Type.STRING },
    name: { type: Type.STRING },
    aliases: { type: Type.ARRAY, items: { type: Type.STRING } },
    role: { type: Type.STRING, enum: CHARACTER_ROLES },
    age: { type: Type.STRING },
    description: { type: Type.STRING },
    visualMemoryPoints: { type: Type.STRING },
    clothingStyles: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, phase: { type: Type.STRING }, description: { type: Type.STRING } } } },
    weapons: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING } } } }
  }
};

const sceneSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    groupName: { type: Type.STRING },
    name: { type: Type.STRING },
    aliases: { type: Type.ARRAY, items: { type: Type.STRING } },
    description: { type: Type.STRING },
    structure: { type: Type.STRING, enum: ["内景", "外景"] },
    atmosphere: { type: Type.STRING },
    style: { type: Type.STRING },
    type: { type: Type.STRING, enum: ["核心据点", "剧情节点", "过场"] },
    frequency: { type: Type.NUMBER }
  }
};

const extractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    characters: { type: Type.ARRAY, items: characterSchema },
    scenes: { type: Type.ARRAY, items: sceneSchema },
  },
};

const storyboardSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    shots: { type: Type.ARRAY, items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        speaker: { type: Type.STRING },
        script: { type: Type.STRING },
        visualPrompt: { type: Type.STRING },
        videoPrompt: { type: Type.STRING },
        shotType: { type: Type.STRING },
        angle: { type: Type.STRING },
        audio: { type: Type.STRING },
        sfx: { type: Type.STRING }
      },
      required: ["id", "speaker", "script", "visualPrompt", "videoPrompt", "shotType", "angle"]
    }}
  }
};

function generateId() { return Math.random().toString(36).substr(2, 9); }
function normalizeKey(str: string) { return str.replace(/[\s\-_]/g, '').toLowerCase(); }

/**
 * 将AI返回的年龄字符串标准化到 VISUAL_AGE_OPTIONS
 */
function normalizeAge(ageStr: string | undefined | null): string {
  if (!ageStr || typeof ageStr !== 'string') {
    return "外表无法判断";
  }
  
  const age = ageStr.trim();
  
  // 如果已经是标准格式，直接返回
  if (VISUAL_AGE_OPTIONS.includes(age)) {
    return age;
  }
  
  // 尝试提取数字年龄
  const numberMatch = age.match(/(\d+)/);
  if (numberMatch) {
    const numAge = parseInt(numberMatch[1], 10);
    if (numAge >= 0 && numAge <= 6) return "幼年 (0-6岁)";
    if (numAge >= 7 && numAge <= 14) return "少年 (7-14岁)";
    if (numAge >= 15 && numAge <= 25) return "青年 (15-25岁)";
    if (numAge >= 26 && numAge <= 40) return "壮年 (26-40岁)";
    if (numAge >= 41 && numAge <= 60) return "中年 (41-60岁)";
    if (numAge >= 61 && numAge < 80) return "老年 (60岁以上)";
    if (numAge >= 80) return "古稀/耄耋 (80岁以上)";
  }
  
  // 中文数字转换
  const chineseNumbers: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15, '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
    '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25, '二十六': 26, '二十七': 27, '二十八': 28, '二十九': 29, '三十': 30,
    '四十': 40, '五十': 50, '六十': 60, '七十': 70, '八十': 80, '九十': 90, '一百': 100
  };
  
  for (const [chinese, num] of Object.entries(chineseNumbers)) {
    if (age.includes(chinese + '岁') || age.includes(chinese)) {
      if (num >= 0 && num <= 6) return "幼年 (0-6岁)";
      if (num >= 7 && num <= 14) return "少年 (7-14岁)";
      if (num >= 15 && num <= 25) return "青年 (15-25岁)";
      if (num >= 26 && num <= 40) return "壮年 (26-40岁)";
      if (num >= 41 && num <= 60) return "中年 (41-60岁)";
      if (num >= 61 && num < 80) return "老年 (60岁以上)";
      if (num >= 80) return "古稀/耄耋 (80岁以上)";
    }
  }
  
  // 描述性年龄匹配
  const lowerAge = age.toLowerCase();
  if (lowerAge.includes('幼') || lowerAge.includes('婴儿') || lowerAge.includes('孩童')) {
    return "幼年 (0-6岁)";
  }
  if (lowerAge.includes('少年') || lowerAge.includes('少年') || lowerAge.includes('学生') || lowerAge.includes('校服')) {
    return "少年 (7-14岁)";
  }
  if (lowerAge.includes('青年') || lowerAge.includes('年轻') || lowerAge.includes('少年气') || lowerAge.includes('稚嫩')) {
    return "青年 (15-25岁)";
  }
  if (lowerAge.includes('壮年') || lowerAge.includes('中年') && !lowerAge.includes('老')) {
    // 需要区分壮年和中年
    if (lowerAge.includes('壮') || lowerAge.includes('三十')) {
      return "壮年 (26-40岁)";
    }
    return "中年 (41-60岁)";
  }
  if (lowerAge.includes('中年') && !lowerAge.includes('壮')) {
    return "中年 (41-60岁)";
  }
  if (lowerAge.includes('老年') || lowerAge.includes('老') || lowerAge.includes('白发') || lowerAge.includes('皱纹')) {
    if (lowerAge.includes('古稀') || lowerAge.includes('耄耋') || lowerAge.includes('八十')) {
      return "古稀/耄耋 (80岁以上)";
    }
    return "老年 (60岁以上)";
  }
  
  return "外表无法判断";
}

/**
 * 检查两个武器名称是否相似
 */
function areWeaponNamesSimilar(name1: string, name2: string): boolean {
  const n1 = name1.trim().toLowerCase();
  const n2 = name2.trim().toLowerCase();
  
  // 完全匹配
  if (n1 === n2) return true;
  
  // 检查是否一个包含另一个（如"黑蛇匕"和"黑蛇匕首"）
  if (n1.includes(n2) || n2.includes(n1)) {
    const lenDiff = Math.abs(n1.length - n2.length);
    // 如果长度差 <= 2，视为相似（如"匕首"和"黑蛇匕"）
    if (lenDiff <= 2) return true;
  }
  
  // 提取核心词进行匹配
  const coreWords1 = extractWeaponCoreWords(n1);
  const coreWords2 = extractWeaponCoreWords(n2);
  
  // 如果核心词有重叠，视为相似
  const commonWords = coreWords1.filter(w => coreWords2.includes(w));
  if (commonWords.length > 0 && commonWords.some(w => w.length >= 2)) {
    return true;
  }
  
  return false;
}

/**
 * 从武器名称中提取核心词
 */
function extractWeaponCoreWords(name: string): string[] {
  const words: string[] = [];
  
  // 提取2-4字的核心词
  for (let len = 2; len <= Math.min(4, name.length); len++) {
    for (let i = 0; i <= name.length - len; i++) {
      const word = name.substr(i, len);
      if (word.length >= 2) {
        words.push(word);
      }
    }
  }
  
  // 也添加单个字符
  for (const char of name) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      words.push(char);
    }
  }
  
  return [...new Set(words)];
}

/**
 * 武器去重：根据武器名称去重（支持相似度匹配），保留描述更详细的版本
 */
function deduplicateWeapons(weapons: Weapon[]): Weapon[] {
  const result: Weapon[] = [];
  
  for (const weapon of weapons) {
    if (!weapon.name || !weapon.name.trim()) continue;
    
    // 查找是否已有相似的武器
    const similarIndex = result.findIndex(existing => 
      areWeaponNamesSimilar(existing.name, weapon.name)
    );
    
    if (similarIndex === -1) {
      // 没有相似的，直接添加
      result.push({ ...weapon });
    } else {
      // 找到相似的，保留描述更详细的版本
      const existing = result[similarIndex];
      const existingDesc = (existing.description || '').trim();
      const newDesc = (weapon.description || '').trim();
      
      if (newDesc.length > existingDesc.length) {
        // 新描述更详细，替换
        result[similarIndex] = { ...weapon };
      } else if (newDesc.length === existingDesc.length && newDesc !== existingDesc) {
        // 长度相同但内容不同，合并描述（用分号分隔）
        result[similarIndex] = {
          ...existing,
          description: `${existingDesc}; ${newDesc}`
        };
      }
      // 如果新描述更短或相同，保留现有的
    }
  }
  
  return result;
}

/**
 * 服装 phase 同义词映射表（使用小写键）
 */
const CLOTHING_PHASE_SYNONYMS: Record<string, string[]> = {
  '大婚': ['婚礼', '婚宴', '结婚', '成婚'],
  '婚礼': ['大婚', '婚宴', '结婚', '成婚'],
  '夜行': ['夜间行动', '夜行装', '夜间', '夜晚行动'],
  '夜间行动': ['夜行', '夜行装', '夜间', '夜晚行动'],
  '战斗': ['战斗官服', '战斗时', '作战', '战斗装'],
  '战斗官服': ['战斗', '战斗时', '作战'],
  '日常': ['常服', '平时', '平常', '日常服装'],
  '常服': ['日常', '平时', '平常'],
  '伪装': ['乔装', '乔装打扮', '易容'],
  '乔装': ['伪装', '乔装打扮', '易容'],
  '初期': ['早期', '前期', '开始'],
  '中期': ['中段', '中期阶段'],
  '知府': ['知府官服', '知府时'],
  '巡抚': ['巡抚官服', '巡抚时'],
  '起床': ['刚起床', '醒来'],
};

/**
 * 获取 phase 的所有同义词（包括自身）
 */
function getPhaseSynonyms(phase: string): string[] {
  const normalized = phase.trim().toLowerCase();
  const synonyms = CLOTHING_PHASE_SYNONYMS[normalized] || [];
  return [normalized, ...synonyms.map(s => s.toLowerCase())];
}

/**
 * 检查两个 phase 是否语义相似
 */
function arePhasesSimilar(phase1: string, phase2: string): boolean {
  const p1 = phase1.trim().toLowerCase();
  const p2 = phase2.trim().toLowerCase();
  
  // 完全匹配
  if (p1 === p2) return true;
  
  // 检查同义词映射
  const synonyms1 = getPhaseSynonyms(p1);
  const synonyms2 = getPhaseSynonyms(p2);
  
  // 如果两个 phase 的同义词集合有交集，视为相似
  if (synonyms1.some(s => synonyms2.includes(s))) return true;
  
  // 关键词匹配：检查是否一个包含另一个（如"战斗官服"包含"战斗"）
  if (p1.includes(p2) || p2.includes(p1)) {
    // 确保不是误匹配（如"战斗"不应该匹配"战斗官服"中的"战斗"）
    // 但如果一个完全包含另一个，且长度差不太大，视为相似
    const lenDiff = Math.abs(p1.length - p2.length);
    if (lenDiff <= 3) return true;
  }
  
  // 提取核心关键词进行匹配
  const coreWords1 = extractCoreWords(p1);
  const coreWords2 = extractCoreWords(p2);
  
  // 如果核心关键词有重叠，视为相似
  const commonCoreWords = coreWords1.filter(w => coreWords2.includes(w));
  if (commonCoreWords.length > 0 && commonCoreWords.some(w => w.length >= 2)) {
    return true;
  }
  
  return false;
}

/**
 * 从 phase 中提取核心关键词（去除常见后缀）
 */
function extractCoreWords(phase: string): string[] {
  const commonSuffixes = ['的', '时', '装', '服', '期', '常', '日', '夜', '战', '婚', '官', '袍', '行动', '官服'];
  let cleaned = phase;
  
  // 移除常见后缀
  for (const suffix of commonSuffixes) {
    if (cleaned.endsWith(suffix) && cleaned.length > suffix.length) {
      cleaned = cleaned.slice(0, -suffix.length);
    }
  }
  
  const words: string[] = [];
  
  // 提取2-4字的核心词
  for (let len = 2; len <= Math.min(4, cleaned.length); len++) {
    for (let i = 0; i <= cleaned.length - len; i++) {
      const word = cleaned.substr(i, len);
      if (word.length >= 2) {
        words.push(word);
      }
    }
  }
  
  // 也添加单个重要字符
  for (const char of cleaned) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      words.push(char);
    }
  }
  
  return [...new Set(words)];
}

/**
 * 服装去重：根据 phase 去重（支持语义相似度匹配），如果 phase 相同或相似则保留描述更详细的版本
 */
function deduplicateClothingStyles(clothingStyles: ClothingStyle[]): ClothingStyle[] {
  const result: ClothingStyle[] = [];
  
  for (const clothing of clothingStyles) {
    if (!clothing.phase || !clothing.phase.trim()) continue;
    
    // 查找是否已有相似的 phase
    const similarIndex = result.findIndex(existing => 
      arePhasesSimilar(existing.phase, clothing.phase)
    );
    
    if (similarIndex === -1) {
      // 没有相似的，直接添加
      result.push({ ...clothing });
    } else {
      // 找到相似的，保留描述更详细的版本
      const existing = result[similarIndex];
      const existingDesc = (existing.description || '').trim();
      const newDesc = (clothing.description || '').trim();
      
      if (newDesc.length > existingDesc.length) {
        // 新描述更详细，替换
        result[similarIndex] = { ...clothing };
      } else if (newDesc.length === existingDesc.length && newDesc !== existingDesc) {
        // 长度相同但内容不同，合并描述（用分号分隔）
        result[similarIndex] = {
          ...existing,
          description: `${existingDesc}; ${newDesc}`
        };
      }
      // 如果新描述更短或相同，保留现有的
    }
  }
  
  return result;
}

/**
 * 使用AI智能合并角色数据，判断武器和服装是否重复并智能合并
 */
async function smartMergeCharacterWithAI(
    existing: Character,
    newChar: Character
): Promise<Character> {
    const ai = getAIClient();
    
    const mergePrompt = `
任务：智能合并角色数据
语言：中文 (Chinese)

你将收到两个角色数据，它们代表同一个角色（groupName相同）。请智能判断并合并：

【已有角色数据】
${JSON.stringify(existing, null, 2)}

【新提取的角色数据】
${JSON.stringify(newChar, null, 2)}

请执行以下操作：

1. **武器去重与合并**：
   - 判断新武器与已有武器是否重复（语义相同或相似）
   - 如果重复，保留描述更详细的版本
   - 如果不重复，合并到武器列表中
   - 返回去重后的完整武器列表

2. **服装去重与合并**：
   - 判断新服装与已有服装是否重复（phase相同或语义相似）
   - 如果重复，保留描述更详细的版本
   - 如果不重复，合并到服装列表中
   - 返回去重后的完整服装列表

3. **其他字段合并**：
   - aliases: 合并并去重
   - age: 如果新年龄更具体（不是"外表无法判断"），使用新年龄
   - description: 如果新描述更详细，使用新描述
   - visualMemoryPoints: 如果新描述更详细，使用新描述

返回合并后的角色JSON数据，格式与输入相同。
`;

    try {
        const response = await callAIWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: mergePrompt }] },
            config: { responseMimeType: "application/json", responseSchema: characterSchema },
        }));
        
        if (response.text) {
            const merged = JSON.parse(response.text);
            // 标准化年龄
            merged.age = normalizeAge(merged.age);
            // 再次去重（双重保障）
            merged.weapons = deduplicateWeapons(merged.weapons || []);
            merged.clothingStyles = deduplicateClothingStyles(merged.clothingStyles || []);
            return merged;
        }
    } catch (e) {
        console.warn("AI智能合并失败，使用程序化合并:", e);
    }
    
    // 如果AI合并失败，使用程序化合并作为后备
    const mergedWeapons = deduplicateWeapons([...(existing.weapons || []), ...(newChar.weapons || [])]);
    const mergedClothing = deduplicateClothingStyles([...(existing.clothingStyles || []), ...(newChar.clothingStyles || [])]);
    
    return {
        ...existing,
        aliases: Array.from(new Set([...existing.aliases, ...(newChar.aliases || [])])),
        weapons: mergedWeapons,
        clothingStyles: mergedClothing,
        age: normalizeAge(newChar.age) !== "外表无法判断" ? normalizeAge(newChar.age) : (existing.age || normalizeAge(newChar.age)),
        description: (newChar.description || '').length > (existing.description || '').length ? newChar.description : existing.description,
        visualMemoryPoints: (newChar.visualMemoryPoints || '').length > (existing.visualMemoryPoints || '').length ? newChar.visualMemoryPoints : existing.visualMemoryPoints
    };
}

export const analyzeEntitiesWithProgress = async (
    fullText: string, 
    customPrompt: string | undefined,
    customDelay: number | undefined,
    onProgress: (percent: number, status: string) => void,
    signal?: AbortSignal
): Promise<{ characters: Character[], scenes: Scene[], debugLog: AnalysisDebugLog[] }> => {
  const CHUNK_SIZE = 50000; 
  const chunks: string[] = [];
  for (let i = 0; i < fullText.length; i += CHUNK_SIZE) chunks.push(fullText.slice(i, i + CHUNK_SIZE));

  const charMap = new Map<string, Character>(); 
  const sceneMap = new Map<string, Scene>(); 
  const debugLogs: AnalysisDebugLog[] = [];
  const basePrompt = (customPrompt && customPrompt.trim().length > 0) ? customPrompt : DEFAULT_PROMPTS.entityExtraction;
  const pacingDelay = customDelay || DEFAULT_PROMPTS.apiDelay || 4000;
  const ai = getAIClient();

  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) throw new Error("Analysis cancelled");
    const chunk = chunks[i];
    const progress = Math.round(((i) / chunks.length) * 100);
    const startTime = Date.now(); 
    onProgress(progress, `正在分析第 ${i + 1}/${chunks.length} 部分...`);

    let contextStr = "";
    if (charMap.size > 0 || sceneMap.size > 0) {
        // 构建详细的角色信息上下文，包含武器、服装等完整信息
        const charDetails: string[] = [];
        charMap.forEach(c => {
            const weaponsInfo = (c.weapons || []).length > 0 
                ? `武器: ${(c.weapons || []).map(w => `${w.name}(${w.description || '无描述'})`).join(', ')}`
                : '';
            const clothingInfo = (c.clothingStyles || []).length > 0
                ? `服装: ${(c.clothingStyles || []).map(cl => `${cl.phase}(${cl.description || '无描述'})`).join(', ')}`
                : '';
            const charInfo = [
                `角色[${c.groupName}_${c.name}]`,
                `年龄: ${c.age || '未知'}`,
                weaponsInfo,
                clothingInfo,
                c.description ? `描述: ${c.description.substring(0, 100)}${c.description.length > 100 ? '...' : ''}` : ''
            ].filter(Boolean).join(' | ');
            charDetails.push(`• ${charInfo}`);
        });
        
        const sceneGroups: Record<string, string[]> = {};
        sceneMap.forEach(s => { if(!sceneGroups[s.groupName]) sceneGroups[s.groupName] = []; sceneGroups[s.groupName].push(s.name); });
        const sceneContextList = Object.entries(sceneGroups).map(([group, areas]) => `• 地点[${group}]: 包含区域 {${areas.join(', ')}}`).join('\n');
        
        contextStr = `\n\n【已知实体详细信息】\n--- 已知角色（含武器、服装） ---\n${charDetails.join('\n')}\n\n--- 已知场景架构 ---\n${sceneContextList}\n\n【重要提示】在提取新信息时，请参考上述已有角色的武器和服装列表。如果新提取的武器/服装与已有的语义相同或相似，请避免重复提取。如果已有信息更详细，请优先使用已有的信息。`;
    }

    try {
        const response = await callAIWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: basePrompt }, { text: contextStr }, { text: `文本片段:\n${chunk}` }] },
            config: { responseMimeType: "application/json", responseSchema: extractionSchema },
        }));
        const rawText = response.text || "";
        if (!rawText || rawText.trim().length === 0) {
            console.warn(`⚠️ Chunk ${i + 1}/${chunks.length} 返回空响应，跳过`);
            debugLogs.push({ timestamp: new Date().toISOString(), chunkIndex: i, rawResponse: "", parsedData: null, error: "AI返回空响应" });
            continue;
        }
        let parsedData;
        try {
            parsedData = JSON.parse(rawText);
        } catch (parseError: any) {
            console.error(`❌ Chunk ${i + 1}/${chunks.length} JSON解析失败:`, parseError);
            console.error("原始响应前200字符:", rawText.substring(0, 200));
            debugLogs.push({ timestamp: new Date().toISOString(), chunkIndex: i, rawResponse: rawText, parsedData: null, error: `JSON解析失败: ${parseError?.message || parseError}` });
            continue;
        }
        debugLogs.push({ timestamp: new Date().toISOString(), chunkIndex: i, rawResponse: rawText, parsedData, usedPrompt: i === 0 ? basePrompt : undefined });

        if (Array.isArray(parsedData.characters)) {
            for (const c of parsedData.characters) {
                // 如果 groupName 为空，优先使用 name 作为 groupName，避免出现"未命名分组"
                // 如果 name 也为空，才使用默认值
                const name = (c.name || "").trim();
                const groupNameRaw = (c.groupName || "").trim();
                const group = groupNameRaw || name || "未命名角色";
                const finalName = name || group;
                const key = normalizeKey(group) + "_" + normalizeKey(finalName);
                const existing = charMap.get(key);
                
                // 标准化年龄
                const normalizedAge = normalizeAge(c.age);
                
                // 去重武器和服装
                const normalizedWeapons = deduplicateWeapons(c.weapons || []);
                const normalizedClothing = deduplicateClothingStyles(c.clothingStyles || []);
                
                if (existing) {
                    // 使用AI智能合并（如果失败则使用程序化合并作为后备）
                    try {
                        const mergedChar = await smartMergeCharacterWithAI(existing, {
                            ...c,
                            id: existing.id,
                            groupName: group,
                            name: finalName,
                            age: normalizedAge,
                            weapons: normalizedWeapons,
                            clothingStyles: normalizedClothing
                        });
                        charMap.set(key, mergedChar);
                    } catch (e) {
                        // AI合并失败，使用程序化合并作为后备
                        console.warn(`AI合并失败，使用程序化合并: ${key}`, e);
                        const mergedWeapons = deduplicateWeapons([...(existing.weapons || []), ...normalizedWeapons]);
                        const mergedClothing = deduplicateClothingStyles([...(existing.clothingStyles || []), ...normalizedClothing]);
                        
                        charMap.set(key, { 
                            ...existing, 
                            aliases: Array.from(new Set([...existing.aliases, ...(c.aliases || [])])), 
                            weapons: mergedWeapons, 
                            clothingStyles: mergedClothing,
                            age: normalizedAge !== "外表无法判断" ? normalizedAge : (existing.age || normalizedAge)
                        });
                    }
                } else {
                    charMap.set(key, { 
                        ...c, 
                        id: generateId(), 
                        groupName: group, 
                        name: finalName,
                        age: normalizedAge,
                        weapons: normalizedWeapons,
                        clothingStyles: normalizedClothing
                    });
                }
            }
        }
        if (Array.isArray(parsedData.scenes)) {
             parsedData.scenes.forEach(s => {
                    const group = s.groupName || "未命名地点";
                    const name = s.name || "未命名场景";
                    const key = normalizeKey(group) + "_" + normalizeKey(name);
                    const existing = sceneMap.get(key);
                    if (existing) sceneMap.set(key, { ...existing, frequency: (existing.frequency || 1) + (s.frequency || 1) });
                    else sceneMap.set(key, { ...s, id: generateId(), groupName: group, name });
            });
        }
        const waitTime = Math.max(0, pacingDelay - (Date.now() - startTime));
        if (waitTime > 0) await delay(waitTime);
    } catch (e: any) {
        if (signal?.aborted) throw new Error("Analysis cancelled");
        console.error(`Chunk ${i} failed`, e);
        // 继续处理下一个chunk，不中断整个流程
    }
  }
  
  // 检查是否有数据被提取
  const finalCharacters = Array.from(charMap.values());
  const finalScenes = Array.from(sceneMap.values());
  
  console.log(`📊 提取完成统计: 角色 ${finalCharacters.length} 个, 场景 ${finalScenes.length} 个`);
  
  if (finalCharacters.length === 0 && finalScenes.length === 0) {
      console.warn("⚠️ 警告: 没有提取到任何角色或场景数据");
      onProgress(100, "分析完成（但未提取到数据）");
      return { characters: [], scenes: [], debugLog: debugLogs };
  }
  
  // 最终阶段：对所有数据进行智能补全和丰满
  if (signal?.aborted) throw new Error("Analysis cancelled");
  onProgress(95, "正在进行最终数据补全和丰满...");
  
  try {
      const enriched = await enrichEntities(
          { characters: finalCharacters, scenes: finalScenes },
          undefined
      );
      console.log(`✅ 补全完成: 角色 ${enriched.characters.length} 个, 场景 ${enriched.scenes.length} 个`);
      onProgress(100, "分析完成！");
      return { characters: enriched.characters, scenes: enriched.scenes, debugLog: debugLogs };
  } catch (e) {
      console.warn("⚠️ 最终补全失败，返回原始数据:", e);
      console.log(`📊 返回原始数据: 角色 ${finalCharacters.length} 个, 场景 ${finalScenes.length} 个`);
      onProgress(100, "分析完成！");
      return { characters: finalCharacters, scenes: finalScenes, debugLog: debugLogs };
  }
};

export const enrichEntities = async (
    data: { characters: Character[], scenes: Scene[] },
    customPrompt: string | undefined
): Promise<{ characters: Character[], scenes: Scene[] }> => {
    const basePrompt = customPrompt || DEFAULT_PROMPTS.entityEnrichment;
    const ai = getAIClient();
    try {
        // 识别需要补全的角色和场景（针对AI视频生成，要求更严格）
        const needsEnrichment = {
            characters: data.characters.filter(c => {
                const descEmpty = !c.description || c.description.trim().length < 20;
                const visualEmpty = !c.visualMemoryPoints || c.visualMemoryPoints.trim().length < 20;
                // 检查是否包含足够的视觉细节（材质、颜色、质感等）
                const hasVisualDetails = c.visualMemoryPoints && (
                    c.visualMemoryPoints.includes('色') || 
                    c.visualMemoryPoints.includes('材质') || 
                    c.visualMemoryPoints.includes('质感') ||
                    c.visualMemoryPoints.includes('光')
                );
                // 检查武器和服装描述是否足够详细
                const weaponsDetailed = (c.weapons || []).every(w => 
                    w.description && w.description.length >= 15 && 
                    (w.description.includes('色') || w.description.includes('材质'))
                );
                const clothingDetailed = (c.clothingStyles || []).every(cl => 
                    cl.description && cl.description.length >= 15 && 
                    (cl.description.includes('色') || cl.description.includes('材质'))
                );
                return descEmpty || visualEmpty || !hasVisualDetails || !weaponsDetailed || !clothingDetailed;
            }),
            scenes: data.scenes.filter(s => {
                const descEmpty = !s.description || s.description.trim().length < 30;
                const atmosEmpty = !s.atmosphere || s.atmosphere.trim().length < 10;
                // 检查是否包含足够的环境细节（光影、材质、空间等）
                const hasEnvDetails = s.description && (
                    s.description.includes('光') || 
                    s.description.includes('影') || 
                    s.description.includes('材质') ||
                    s.description.includes('空间') ||
                    s.description.includes('布局')
                );
                return descEmpty || atmosEmpty || !hasEnvDetails;
            })
        };
        
        const response = await callAIWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: basePrompt }, { text: `【待补全数据】\n${JSON.stringify(data, null, 2)}\n\n【需要重点补全的项】\n角色: ${needsEnrichment.characters.map(c => c.name).join(', ')}\n场景: ${needsEnrichment.scenes.map(s => s.name).join(', ')}` }] },
            config: { responseMimeType: "application/json", responseSchema: extractionSchema },
        }));
        if (response.text) {
            const result = JSON.parse(response.text);
            const updatedChars = data.characters.map(orig => {
                const en = (result.characters || []).find((c: any) => c.id === orig.id);
                if (en) {
                    // 标准化年龄
                    const normalizedAge = normalizeAge(en.age || orig.age);
                    // 去重武器和服装
                    const normalizedWeapons = deduplicateWeapons(en.weapons || orig.weapons || []);
                    const normalizedClothing = deduplicateClothingStyles(en.clothingStyles || orig.clothingStyles || []);
                    
                    // 智能补全：针对AI视频生成，优先使用更详细且包含视觉细节的描述
                    const origDesc = (orig.description || '').trim();
                    const newDesc = (en.description || '').trim();
                    const finalDescription = (!origDesc || origDesc.length < 20) 
                        ? (newDesc || origDesc)
                        : (newDesc.length > origDesc.length && (
                            newDesc.includes('色') || newDesc.includes('材质') || newDesc.includes('质感') || 
                            newDesc.includes('光') || newDesc.includes('动作') || newDesc.includes('姿态')
                        )) ? newDesc : origDesc;
                    
                    const origVisual = (orig.visualMemoryPoints || '').trim();
                    const newVisual = (en.visualMemoryPoints || '').trim();
                    const finalVisual = (!origVisual || origVisual.length < 20)
                        ? (newVisual || origVisual)
                        : (newVisual.length > origVisual.length && (
                            newVisual.includes('色') || newVisual.includes('材质') || newVisual.includes('质感') ||
                            newVisual.includes('脸型') || newVisual.includes('眼睛') || newVisual.includes('发型')
                        )) ? newVisual : origVisual;
                    
                    // 增强武器和服装描述（如果AI返回的更详细）
                    const enhancedWeapons = normalizedWeapons.map(w => {
                        const origW = (orig.weapons || []).find(ow => ow.name === w.name);
                        if (origW && origW.description && origW.description.length >= 15 && 
                            (origW.description.includes('色') || origW.description.includes('材质'))) {
                            return origW; // 保留已有的详细描述
                        }
                        return w; // 使用AI增强的描述
                    });
                    
                    const enhancedClothing = normalizedClothing.map(cl => {
                        const origCl = (orig.clothingStyles || []).find(oc => oc.phase === cl.phase);
                        if (origCl && origCl.description && origCl.description.length >= 15 && 
                            (origCl.description.includes('色') || origCl.description.includes('材质'))) {
                            return origCl; // 保留已有的详细描述
                        }
                        return cl; // 使用AI增强的描述
                    });
                    
                    return { 
                        ...orig, 
                        age: normalizedAge, 
                        description: finalDescription, 
                        visualMemoryPoints: finalVisual,
                        weapons: enhancedWeapons,
                        clothingStyles: enhancedClothing
                    };
                }
                return orig;
            });
            const updatedScenes = data.scenes.map(orig => {
                 const en = (result.scenes || []).find((s: any) => s.id === orig.id);
                 if (en) {
                     const origDesc = (orig.description || '').trim();
                     const newDesc = (en.description || '').trim();
                     const finalDescription = (!origDesc || origDesc.length < 30) 
                         ? (newDesc || origDesc)
                         : (newDesc.length > origDesc.length && (
                             newDesc.includes('光') || newDesc.includes('影') || newDesc.includes('材质') ||
                             newDesc.includes('空间') || newDesc.includes('布局') || newDesc.includes('时间')
                         )) ? newDesc : origDesc;
                     
                     const origAtmos = (orig.atmosphere || '').trim();
                     const newAtmos = (en.atmosphere || '').trim();
                     const finalAtmosphere = (!origAtmos || origAtmos.length < 10)
                         ? (newAtmos || origAtmos)
                         : (newAtmos.length > origAtmos.length && (
                             newAtmos.includes('氛围') || newAtmos.includes('情绪') || newAtmos.includes('感受')
                         )) ? newAtmos : origAtmos;
                     
                     return { ...orig, description: finalDescription, atmosphere: finalAtmosphere };
                 }
                 return orig;
            });
            return { characters: updatedChars, scenes: updatedScenes };
        }
        return data;
    } catch (e) { console.error(e); throw e; }
};

/**
 * Regex-based Chapter Splitting
 * Enhanced to handle "一章一节", "第一章" and other variations more reliably.
 */
export const splitChaptersRegex = (fullText: string): ChapterMetadata[] => {
    const chapters: ChapterMetadata[] = [];
    // More robust regex for common Chinese chapter patterns
    const chapterRegex = /(?:^|\n)\s*(第?\s*[一二三四五六七八九十百千万0-9]+\s*[章节回卷集部话][^章节回卷集部话\n]{0,30})(?:\n|$)/g;
    let match;
    const matches: { title: string, index: number }[] = [];

    while ((match = chapterRegex.exec(fullText)) !== null) {
        matches.push({ title: match[1].trim(), index: match.index });
    }

    if (matches.length === 0) {
        return [{ title: "全本正文", summary: "未检测到章节标识，提取全文。", startLine: fullText.slice(0, 50) }];
    }

    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        const end = i < matches.length - 1 ? matches[i+1].index : fullText.length;
        const content = fullText.substring(start, end).trim();
        // Finding a non-header line for better matching later
        const lines = content.split('\n');
        const startLine = lines.find(l => l.trim().length > 10 && !l.includes(matches[i].title)) || matches[i].title;

        chapters.push({
            title: matches[i].title,
            summary: `第 ${i+1} 章节`,
            startLine: startLine.substring(0, 50)
        });
    }
    return chapters;
};

/**
 * Normalize Chapter Entities: Replaces aliases with GroupName_FormName
 */
export const normalizeTextEntities = (text: string, characters: Character[], scenes: Scene[]): string => {
    let normalized = text;
    
    // Create mapping pairs (alias -> Group_Name)
    const entityMap: { key: string, replacement: string, length: number }[] = [];
    
    characters.forEach(c => {
        // Form name replacement
        entityMap.push({ key: c.name, replacement: `${c.groupName}_${c.name}`, length: c.name.length });
        // Alias replacements
        (c.aliases || []).forEach(a => {
            if (a.length > 1) entityMap.push({ key: a, replacement: `${c.groupName}_${c.name}`, length: a.length });
        });
    });

    scenes.forEach(s => {
        // Area name replacement
        entityMap.push({ key: s.name, replacement: `${s.groupName}_${s.name}`, length: s.name.length });
        // Alias replacements
        (s.aliases || []).forEach(a => {
            if (a.length > 1) entityMap.push({ key: a, replacement: `${s.groupName}_${s.name}`, length: a.length });
        });
    });

    // Sort by length descending to replace longest matches first (e.g. "孙悟空" before "悟空")
    entityMap.sort((a, b) => b.length - a.length);

    // Use a temporary map to avoid double replacement issues (e.g. replacing parts of already replaced strings)
    // For simplicity, we iterate and replace, but the sorted order handles the most critical nesting cases.
    entityMap.forEach(item => {
        const regex = new RegExp(item.key, 'g');
        normalized = normalized.replace(regex, item.replacement);
    });

    return normalized;
};

export const generateStoryboard = async (
  chapterText: string,
  context: { characters: Character[], scenes: Scene[] },
  customPrompt: string | undefined
): Promise<Shot[]> => {
  // 构建详细的角色上下文，包含服装、武器、动作特征等完整信息
  const charContext = context.characters.map(c => {
    const weaponsInfo = (c.weapons || []).length > 0
      ? `武器: ${(c.weapons || []).map(w => `${w.name}(${w.description || '无描述'})`).join(', ')}`
      : '武器: 无';
    const clothingInfo = (c.clothingStyles || []).length > 0
      ? `服装: ${(c.clothingStyles || []).map(cl => `${cl.name || cl.phase || '未命名'}(${cl.description || '无描述'})`).join(', ')}`
      : '服装: 无';
    
    // 从角色描述中提取动作特征（简单提取，AI会在分镜生成时进一步处理）
    const description = c.description || '';
    const visualMemory = c.visualMemoryPoints || '';
    const actionFeatures = [];
    if (description.includes('行走') || description.includes('走路') || visualMemory.includes('行走')) actionFeatures.push('行走特征');
    if (description.includes('站') || description.includes('站立') || visualMemory.includes('站姿')) actionFeatures.push('站姿特征');
    if (description.includes('习惯') || description.includes('经常')) actionFeatures.push('习惯性动作');
    if (visualMemory.includes('轻盈') || description.includes('轻盈')) actionFeatures.push('动作轻盈');
    if (visualMemory.includes('挺拔') || description.includes('挺拔')) actionFeatures.push('姿态挺拔');
    
    return [
      `角色: ${c.groupName}_${c.name}`,
      `外貌: ${c.visualMemoryPoints || '无描述'}`,
      `描述: ${c.description || '无描述'}`,
      `年龄: ${c.age || '未知'}`,
      weaponsInfo,
      clothingInfo,
      actionFeatures.length > 0 ? `动作特征: ${actionFeatures.join(', ')}` : '动作特征: 无特殊动作特征'
    ].join('\n');
  }).join('\n---\n');
  
  // 构建详细的场景上下文，包含氛围、结构、类型、风格、时间、天气、材质等完整信息
  const sceneContext = context.scenes.map(s => {
    // 从场景描述中提取时间、天气、材质信息（简单提取，AI会在分镜生成时进一步处理）
    const description = s.description || '';
    const timeMatch = description.match(/(深夜|黄昏|正午|清晨|傍晚|白天|夜晚)/);
    const weatherMatch = description.match(/(雨天|雪天|晴天|阴天|下雪|下雨)/);
    const materialMatch = description.match(/(石质|木质|金属|草地|泥土)/);
    
    return [
      `场景: ${s.groupName}_${s.name}`,
      `描述: ${s.description || '无描述'}`,
      `氛围: ${s.atmosphere || '无描述'}`,
      `结构: ${s.structure || '未知'}`,
      `类型: ${s.type || '未知'}`,
      `风格: ${s.style || '无描述'}`,
      `时间: ${timeMatch ? timeMatch[0] : '未明确（请根据上下文推断）'}`,
      `天气: ${weatherMatch ? weatherMatch[0] : '未明确（请根据上下文推断）'}`,
      `材质: ${materialMatch ? materialMatch[0] : '未明确（请根据场景类型推断）'}`
    ].join('\n');
  }).join('\n---\n');
  
  const basePrompt = customPrompt || DEFAULT_PROMPTS.storyboard;
  const ai = getAIClient();
  try {
    const response = await callAIWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: { parts: [{ text: basePrompt }, { text: `【视觉库参考 - 完整信息】\n${charContext}\n\n${sceneContext}\n\n【正文文本】:\n${chapterText}` }] },
      config: { responseMimeType: "application/json", responseSchema: storyboardSchema },
    }));
    return response.text ? JSON.parse(response.text).shots : [];
  } catch (error) { console.error(error); throw error; }
};

export const generateCustomExport = async (project: any, formatTemplate: string, instructions: string): Promise<string> => {
    const leanProject = { title: project.title, characters: project.characters, scenes: project.scenes, storyboards: project.chapters };
    const ai = getAIClient();
    try {
        const response = await callAIWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts: [{ text: "JSON formatter assistant." }, { text: `[JSON]\n${JSON.stringify(leanProject)}` }, { text: `[FORMAT]\n${formatTemplate}` }, { text: `[INST]\n${instructions}` }] }
        }));
        return response.text || "";
    } catch (e) { throw new Error("导出失败"); }
}
