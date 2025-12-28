import { Project } from "../types";

export const fileSystem = {
  
  /**
   * Prompts user to select a directory to store projects.
   */
  async openDirectory(): Promise<any> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error("您的浏览器不支持本地文件系统访问 (File System Access API)。建议使用 Chrome 或 Edge。");
    }
    
    // Safety check for cross-origin iframes
    if (window.self !== window.top) {
        throw new Error("安全限制：无法在预览框架(Iframe)中直接访问本地文件系统。请在独立窗口中打开应用以使用此功能。");
    }

    try {
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      return dirHandle;
    } catch (e: any) {
      // User cancelled or error
      console.error(e);
      if (e.name === 'SecurityError' || (e.message && e.message.includes('Cross origin sub frames'))) {
          throw new Error("安全限制：无法在当前预览环境或框架中访问本地文件。");
      }
      throw e;
    }
  },

  /**
   * Scans the directory for .json files and attempts to parse them as Projects.
   * Supports both flat structure (project.json in root) and nested structure (settings.json in subdirectories).
   */
  async loadProjectsFromDirectory(dirHandle: any): Promise<Project[]> {
    const projects: Project[] = [];
    
    // Request permission if needed
    try {
        if ((await dirHandle.queryPermission({ mode: 'read' })) !== 'granted') {
           if ((await dirHandle.requestPermission({ mode: 'read' })) !== 'granted') {
               throw new Error("Permission denied to read directory");
           }
        }
    } catch (e) {
        console.error("Permission check failed", e);
        throw new Error("无法获取目录读取权限。");
    }

    // 用于存储每个子目录的项目数据（按目录名称索引）
    // 注意：使用目录名称而不是完整路径，因为每个子目录就是一个项目
    const projectMap = new Map<string, { dirHandle: any, settings?: any, original?: any, storyboards?: any }>();

    // 第一遍扫描：只扫描直接子目录（每个子目录是一个项目）
    let directoryCount = 0;
    for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory') {
            // 每个子目录是一个项目
            const projectDirName = entry.name;
            directoryCount++;
            console.log(`📁 [${directoryCount}] 发现项目目录: ${projectDirName}`);
            
            if (!projectMap.has(projectDirName)) {
                projectMap.set(projectDirName, { dirHandle: entry });
            }
            
            // 扫描该子目录中的 JSON 文件
            let foundSettings = false;
            let foundOriginal = false;
            let foundStoryboards = false;
            
            for await (const fileEntry of entry.values()) {
                if (fileEntry.kind === 'file' && fileEntry.name.endsWith('.json')) {
                    try {
                        const file = await fileEntry.getFile();
                        const text = await file.text();
                        const data = JSON.parse(text);
                        
                        const dirData = projectMap.get(projectDirName)!;
                        
                        // 处理项目文件
                        if (fileEntry.name === 'settings.json' && data.id && data.title) {
                            console.log(`  📋 找到 settings.json: ${data.title} (${data.id})`);
                            dirData.settings = data;
                            foundSettings = true;
                        } else if (fileEntry.name === 'original.json') {
                            console.log(`  📝 找到 original.json`);
                            dirData.original = data;
                            foundOriginal = true;
                        } else if (fileEntry.name === 'storyboards.json') {
                            console.log(`  🎬 找到 storyboards.json`);
                            dirData.storyboards = data;
                            foundStoryboards = true;
                        }
                    } catch (e) {
                        console.error(`  ❌ 解析文件失败 (${projectDirName}/${fileEntry.name}):`, e);
                    }
                }
            }
            
            console.log(`  📊 目录 "${projectDirName}" 文件统计:`, {
                settings: foundSettings,
                original: foundOriginal,
                storyboards: foundStoryboards
            });
        } else if (entry.kind === 'file' && entry.name.endsWith('.json')) {
            // 根目录下的完整项目文件（兼容旧格式）
            try {
                const file = await entry.getFile();
                const text = await file.text();
                const data = JSON.parse(text);
                
                if (data.id && data.title && Array.isArray(data.chapters)) {
                    console.log(`✅ 找到根目录项目文件: ${data.title} (${data.id})`);
                    projects.push(data);
                }
            } catch (e) {
                console.error(`❌ 解析根目录文件失败 (${entry.name}):`, e);
            }
        }
    }

    // 用于跟踪已处理的项目ID，避免重复（按项目ID，而不是文件夹名称）
    const processedIds = new Set<string>();

    console.log(`📊 准备构建项目，共 ${projectMap.size} 个目录需要处理`);

    // 第二遍：从收集的数据构建项目（每个子目录构建一个项目）
    for (const [projectDirName, dirData] of projectMap.entries()) {
        console.log(`\n🔍 处理目录: ${projectDirName}`, {
            hasSettings: !!dirData.settings,
            hasOriginal: !!dirData.original,
            hasStoryboards: !!dirData.storyboards
        });
        
        if (!dirData.settings) {
            console.warn(`⚠️ 目录 "${projectDirName}" 中没有找到 settings.json，跳过`);
            continue;
        }
        
        try {
            const settings = dirData.settings;
            
            // 验证 settings.json 的基本字段
            if (!settings.id || !settings.title) {
                console.error(`❌ 目录 "${projectDirName}" 的 settings.json 缺少必需字段 (id: ${!!settings.id}, title: ${!!settings.title})`);
                continue;
            }
            
            // 检查是否已经处理过这个项目ID（避免重复处理同一个项目）
            if (processedIds.has(settings.id)) {
                console.log(`⏭️  跳过已处理的项目ID: ${settings.id} (${settings.title}) 在目录: ${projectDirName}`);
                continue;
            }
            
            processedIds.add(settings.id);
            
            console.log(`🔧 构建项目: ${settings.title} (${settings.id}) 从目录: ${projectDirName}`);
            
            // 读取 original.json 的 fullText
            let fullText = settings.fullText || '';
            if (dirData.original && dirData.original.fullText) {
                fullText = dirData.original.fullText;
                console.log(`📝 从 original.json 读取 fullText，长度: ${fullText.length}`);
            }
            
            // 读取 storyboards.json 并合并到 chapters
            let chapters = Array.isArray(settings.chapters) ? [...settings.chapters] : [];
            if (dirData.storyboards && dirData.storyboards.chapters) {
                console.log(`🎬 合并 storyboards.json 的分镜数据`, {
                    storyboardChaptersCount: dirData.storyboards.chapters.length,
                    settingsChaptersCount: chapters.length
                });
                const storyboardChapters = dirData.storyboards.chapters;
                
                // 将 storyboard 数据合并到对应的章节
                let mergedCount = 0;
                chapters = chapters.map((chapter: any) => {
                    const storyboardChapter = storyboardChapters.find(
                        (sc: any) => sc.chapterId === chapter.id
                    );
                    
                    if (storyboardChapter && Array.isArray(storyboardChapter.storyboard)) {
                        // 将 storyboard 数组转换为 Shot 格式
                        // 将 storyboard 数组转换为 Shot 格式
                        // 兼容uid字段，但优先使用id
                        const storyboard = storyboardChapter.storyboard.map((shot: any) => ({
                            id: shot.id || shot.uid || crypto.randomUUID(),
                            uid: shot.uid, // 保留uid字段以兼容旧数据
                            speaker: shot.speaker || '',
                            script: shot.script || '',
                            visualPrompt: shot.visualPrompt || '',
                            videoPrompt: shot.videoPrompt || '',
                            shotType: shot.shotType || '',
                            angle: shot.angle || '',
                            audio: shot.audio || '',
                            sfx: shot.sfx || ''
                        }));
                        
                        mergedCount++;
                        console.log(`  ✓ 章节 "${chapter.title}" 合并了 ${storyboard.length} 个分镜`);
                        
                        return {
                            ...chapter,
                            storyboard: storyboard
                        };
                    } else {
                        console.log(`  ⚠ 章节 "${chapter.title}" (${chapter.id}) 未找到对应的分镜数据`);
                    }
                    return chapter;
                });
                
                console.log(`✅ 合并完成，${mergedCount}/${chapters.length} 个章节包含分镜数据`);
            } else {
                console.log(`⚠️ 未找到 storyboards.json 或 chapters 数据`);
            }
            
            // 构建完整的项目对象，并进行字段名兼容处理
            const project: Project = {
                id: settings.id,
                title: settings.title,
                createdAt: settings.createdAt || Date.now(),
                fullText: fullText,
                characters: Array.isArray(settings.characters) ? settings.characters.map((c: any) => {
                    // 字段名兼容：visualAge -> age，确保统一使用age字段
                    const age = c.age || c.visualAge || '';
                    // 移除旧字段（visualAge, actualAge），使用统一字段名
                    const { visualAge, actualAge, ...restChar } = c;
                    const normalizedChar = {
                        ...restChar,
                        age: age, // 统一使用 age 字段
                        aliases: Array.isArray(c.aliases) ? c.aliases : [],
                        clothingStyles: Array.isArray(c.clothingStyles) ? c.clothingStyles.map((cl: any) => ({
                            name: cl.name || '', // 兼容旧数据，如果没有name字段则使用空字符串
                            phase: cl.phase || '',
                            description: cl.description || ''
                        })) : [],
                        weapons: Array.isArray(c.weapons) ? c.weapons : []
                    };
                    // 如果进行了字段转换，记录日志
                    if (c.visualAge && !c.age) {
                        console.log(`🔄 字段转换: ${c.name || c.groupName} visualAge -> age`);
                    }
                    return normalizedChar;
                }) : [],
                scenes: Array.isArray(settings.scenes) ? settings.scenes : [],
                chapters: chapters,
                prompts: settings.prompts,
                debugLog: settings.debugLog
            };
            
            console.log(`✅ 项目构建完成: ${project.title}`, {
                chaptersCount: project.chapters.length,
                charactersCount: project.characters.length,
                scenesCount: project.scenes.length,
                fullTextLength: project.fullText.length,
                sampleCharacter: project.characters.length > 0 ? {
                    name: project.characters[0].name,
                    age: project.characters[0].age,
                    hasVisualAge: !!(project.characters[0] as any).visualAge,
                    groupName: project.characters[0].groupName,
                    role: project.characters[0].role
                } : null,
                allCharacterNames: project.characters.map((c: any) => c.name || c.groupName).slice(0, 5)
            });
            
            // 验证字段转换是否成功
            const hasVisualAge = project.characters.some((c: any) => (c as any).visualAge);
            if (hasVisualAge) {
                console.warn(`⚠️ 警告: 项目 "${project.title}" 中仍有角色包含 visualAge 字段，字段转换可能未完全生效`);
            }
            
            projects.push(project);
        } catch (e) {
            console.error(`❌ 构建项目失败 (${projectDirName}):`, e);
        }
    }

    console.log(`\n📂 扫描完成统计:`, {
        发现的目录数: projectMap.size,
        成功构建的项目数: projects.length,
        跳过的目录数: projectMap.size - projects.length
    });
    
    if (projects.length < projectMap.size) {
        console.warn(`⚠️ 警告: 只构建了 ${projects.length}/${projectMap.size} 个项目，可能有目录缺少 settings.json 或格式不正确`);
    }
    
    return projects;
  },

  /**
   * Saves a project as a folder structure with 3 JSON files:
   * - settings.json: project settings, characters, scenes, chapters (without fullText)
   * - original.json: fullText (original novel text)
   * - storyboards.json: storyboard data
   */
  async saveProjectToDirectory(dirHandle: any, project: Project, oldTitle?: string): Promise<void> {
      if (!dirHandle) return;

      // 首先尝试通过项目 ID 查找现有文件夹（优先使用项目ID，而不是标题）
      let existingFolderByProjectId: any = null;
      let existingFolderName: string | null = null;
      
      try {
          // 扫描所有子目录，查找包含相同项目 ID 的文件夹
          for await (const entry of dirHandle.values()) {
              if (entry.kind === 'directory') {
                  try {
                      const settingsHandle = await entry.getFileHandle('settings.json');
                      const settingsFile = await settingsHandle.getFile();
                      const settingsData = JSON.parse(await settingsFile.text());
                      
                      if (settingsData.id === project.id) {
                          existingFolderByProjectId = entry;
                          existingFolderName = entry.name;
                          console.log(`✅ 通过项目 ID 找到现有文件夹: ${existingFolderName} (项目ID: ${project.id})`);
                          break;
                      }
                  } catch (e) {
                      // 忽略无法读取的文件夹
                      continue;
                  }
              }
          }
      } catch (e) {
          console.warn('扫描文件夹时出错:', e);
      }

      // Sanitize folder name (keep Chinese characters, alphanumeric, and common separators)
      const safeTitle = project.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
      const projectFolderName = safeTitle || `project_${project.id.substring(0, 6)}`;

      try {
          let projectFolderHandle: any;
          let oldFolderName: string | null = null;
          let finalFolderName: string = projectFolderName; // 初始化 finalFolderName

          // 如果通过项目 ID 找到了现有文件夹，优先使用它
          if (existingFolderByProjectId) {
              projectFolderHandle = existingFolderByProjectId;
              oldFolderName = existingFolderName;
              finalFolderName = existingFolderName || projectFolderName;
              console.log(`📁 使用现有文件夹: ${existingFolderName} (项目ID: ${project.id})`);
              
              // 如果文件夹名称与项目标题不匹配，可以选择重命名（可选）
              // 这里我们保持原文件夹名称，避免频繁重命名导致的问题
          } else {
              // 如果没有通过项目ID找到，使用原有的逻辑：通过标题查找或创建
              
              // 如果项目被重命名，先检查旧文件夹
              if (oldTitle && oldTitle !== project.title) {
                  const oldSafeTitle = oldTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
                  
                  if (oldSafeTitle && oldSafeTitle !== projectFolderName) {
                      // 检查旧文件夹是否存在
                      try {
                          await dirHandle.getDirectoryHandle(oldSafeTitle);
                          oldFolderName = oldSafeTitle;
                          console.log(`🔄 检测到重命名: "${oldSafeTitle}" -> "${projectFolderName}"`);
                      } catch (e: any) {
                          // 旧文件夹不存在，正常
                          if (e.name !== 'NotFoundError') {
                              console.warn(`检查旧文件夹时出错:`, e);
                          }
                      }
                  }
              }

              // 检查新文件夹是否已存在
              finalFolderName = projectFolderName;
              let folderExists = false;
              let isSameProject = false;
              
              try {
                  const existingFolder = await dirHandle.getDirectoryHandle(projectFolderName);
                  folderExists = true;
                  
                  // 检查是否是同一个项目（通过读取 settings.json 中的 id）
                  try {
                      const settingsHandle = await existingFolder.getFileHandle('settings.json');
                      const settingsFile = await settingsHandle.getFile();
                      const settingsData = JSON.parse(await settingsFile.text());
                      
                      if (settingsData.id === project.id) {
                          // 是同一个项目，使用现有文件夹
                          isSameProject = true;
                          projectFolderHandle = existingFolder;
                          console.log(`✅ 使用现有文件夹: ${projectFolderName} (同一项目)`);
                      } else {
                          // 不是同一个项目，需要创建新文件夹（添加后缀）
                          console.log(`⚠️ 文件夹 "${projectFolderName}" 已存在但属于不同项目，创建新文件夹`);
                          let counter = 1;
                          let newFolderName = `${projectFolderName}_${counter}`;
                          
                          while (true) {
                              try {
                                  await dirHandle.getDirectoryHandle(newFolderName);
                                  // 文件夹存在，继续尝试下一个
                                  counter++;
                                  newFolderName = `${projectFolderName}_${counter}`;
                              } catch (e: any) {
                                  if (e.name === 'NotFoundError') {
                                      // 找到可用的文件夹名
                                      finalFolderName = newFolderName;
                                      break;
                                  } else {
                                      throw e;
                                  }
                              }
                          }
                          console.log(`📁 使用新文件夹名: ${finalFolderName}`);
                      }
                  } catch (e) {
                      // settings.json 不存在或读取失败，当作不同项目处理
                      console.warn(`无法读取现有文件夹的 settings.json:`, e);
                      let counter = 1;
                      let newFolderName = `${projectFolderName}_${counter}`;
                      
                      while (true) {
                          try {
                              await dirHandle.getDirectoryHandle(newFolderName);
                              counter++;
                              newFolderName = `${projectFolderName}_${counter}`;
                          } catch (e: any) {
                              if (e.name === 'NotFoundError') {
                                  finalFolderName = newFolderName;
                                  break;
                              } else {
                                  throw e;
                              }
                          }
                      }
                      console.log(`📁 使用新文件夹名: ${finalFolderName}`);
                  }
              } catch (e: any) {
                  // 新文件夹不存在，正常创建
                  if (e.name !== 'NotFoundError') {
                      console.warn(`检查新文件夹时出错:`, e);
                  }
              }

              // 如果不是使用现有文件夹，创建新文件夹
              if (!isSameProject) {
                  // 如果是重命名且新文件夹已存在（但不是同一项目），先删除
                  if (oldFolderName && folderExists && !isSameProject && finalFolderName === projectFolderName) {
                      try {
                          await dirHandle.removeEntry(projectFolderName, { recursive: true });
                          console.log(`🗑️ 已删除冲突的文件夹: ${projectFolderName}`);
                      } catch (e) {
                          console.warn(`无法删除冲突文件夹:`, e);
                      }
                  }
                  
                  // 创建或获取项目文件夹
                  try {
                      projectFolderHandle = await dirHandle.getDirectoryHandle(finalFolderName, { create: true });
                  } catch (e) {
                      console.error("Failed to get/create project folder:", e);
                      throw new Error("无法创建项目文件夹，请检查目录权限。");
                  }
              }
          }

          // 1. Save settings.json (project data without fullText)
          // 确保保存时使用统一的字段名（age），不保存visualAge
          const settingsData = {
              id: project.id,
              title: project.title,
              createdAt: project.createdAt,
              characters: (project.characters || []).map((c: any) => {
                  // 确保保存时移除visualAge和actualAge，只保留age
                  const { visualAge, actualAge, ...rest } = c;
                  return {
                      ...rest,
                      age: c.age || '' // 确保使用age字段
                  };
              }),
              scenes: project.scenes || [],
              chapters: project.chapters?.map(ch => ({
                  id: ch.id,
                  title: ch.title,
                  summary: ch.summary,
                  content: ch.content
                  // Note: storyboard is saved separately in storyboards.json
              })) || [],
              prompts: project.prompts,
              debugLog: project.debugLog
          };

          try {
              const settingsHandle = await projectFolderHandle.getFileHandle('settings.json', { create: true });
              const settingsWritable = await settingsHandle.createWritable();
              await settingsWritable.write(JSON.stringify(settingsData, null, 2));
              await settingsWritable.close();
              console.log(`✅ 已保存 settings.json`);
          } catch (e) {
              console.error("Failed to save settings.json:", e);
              throw new Error("保存 settings.json 失败。");
          }

          // 2. Save original.json (fullText)
          const originalData = {
              fullText: project.fullText || ''
          };

          try {
              const originalHandle = await projectFolderHandle.getFileHandle('original.json', { create: true });
              const originalWritable = await originalHandle.createWritable();
              await originalWritable.write(JSON.stringify(originalData, null, 2));
              await originalWritable.close();
              console.log(`✅ 已保存 original.json`);
          } catch (e) {
              console.error("Failed to save original.json:", e);
              throw new Error("保存 original.json 失败。");
          }

          // 3. Save storyboards.json (storyboard data)
          const storyboardsData = {
              projectId: project.id,
              chapters: (project.chapters || []).map(ch => ({
                  chapterId: ch.id,
                  storyboard: (ch.storyboard || []).map(shot => ({
                      uid: shot.id,
                      id: shot.id,
                      speaker: shot.speaker,
                      script: shot.script,
                      visualPrompt: shot.visualPrompt,
                      videoPrompt: shot.videoPrompt,
                      shotType: shot.shotType,
                      angle: shot.angle,
                      audio: shot.audio,
                      sfx: shot.sfx
                  }))
              }))
          };

          try {
              const storyboardsHandle = await projectFolderHandle.getFileHandle('storyboards.json', { create: true });
              const storyboardsWritable = await storyboardsHandle.createWritable();
              await storyboardsWritable.write(JSON.stringify(storyboardsData, null, 2));
              await storyboardsWritable.close();
              console.log(`✅ 已保存 storyboards.json`);
          } catch (e) {
              console.error("Failed to save storyboards.json:", e);
              throw new Error("保存 storyboards.json 失败。");
          }

          console.log(`💾 项目 "${project.title}" 已保存到文件夹: ${finalFolderName}`);
          
          // 如果重命名成功，删除旧文件夹（在保存成功后）
          if (oldFolderName && oldFolderName !== finalFolderName) {
              try {
                  await dirHandle.removeEntry(oldFolderName, { recursive: true });
                  console.log(`🗑️ 已删除旧文件夹: ${oldFolderName}`);
              } catch (e) {
                  console.warn(`无法删除旧文件夹 ${oldFolderName}:`, e);
                  // 不抛出错误，因为数据已经保存成功
              }
          }
      } catch (e: any) {
          console.error("Failed to save project to disk", e);
          throw new Error(`保存项目失败: ${e.message || '未知错误'}`);
      }
  },

  /**
   * Deletes a project folder from the directory by project ID.
   */
  async deleteProjectFromDirectory(dirHandle: any, projectId: string): Promise<void> {
      if (!dirHandle) return;

      try {
          // 扫描所有子目录，查找包含相同项目 ID 的文件夹
          let folderToDelete: any = null;
          let folderName: string | null = null;
          
          for await (const entry of dirHandle.values()) {
              if (entry.kind === 'directory') {
                  try {
                      const settingsHandle = await entry.getFileHandle('settings.json');
                      const settingsFile = await settingsHandle.getFile();
                      const settingsData = JSON.parse(await settingsFile.text());
                      
                      if (settingsData.id === projectId) {
                          folderToDelete = entry;
                          folderName = entry.name;
                          console.log(`✅ 找到要删除的项目文件夹: ${folderName} (项目ID: ${projectId})`);
                          break;
                      }
                  } catch (e) {
                      // 忽略无法读取的文件夹
                      continue;
                  }
              }
          }

          if (folderToDelete && folderName) {
              try {
                  await dirHandle.removeEntry(folderName, { recursive: true });
                  console.log(`🗑️ 已删除项目文件夹: ${folderName}`);
              } catch (e: any) {
                  console.error(`删除项目文件夹失败 (${folderName}):`, e);
                  throw new Error(`删除项目文件夹失败: ${e.message || '未知错误'}`);
              }
          } else {
              console.warn(`⚠️ 未找到项目ID为 ${projectId} 的文件夹，可能已经被删除或不存在`);
          }
      } catch (e: any) {
          console.error("Failed to delete project from disk", e);
          throw new Error(`删除项目失败: ${e.message || '未知错误'}`);
      }
  },

  /**
   * 通过主项目API保存项目到数据文件夹
   */
  async saveProjectToMainAPI(project: Project, oldTitle?: string): Promise<void> {
      try {
          // 获取当前子项目的ID
          const siteId = (import.meta.env.VITE_SITE_ID as string) || '--';
          
          // 1. 保存 settings.json（项目设置，不包含 fullText）
          const settingsData = {
              id: project.id,
              title: project.title,
              createdAt: project.createdAt,
              characters: project.characters,
              scenes: project.scenes,
              chapters: project.chapters.map(ch => ({
                  id: ch.id,
                  title: ch.title,
                  summary: ch.summary,
                  content: ch.content
                  // 不包含 storyboard，它在 storyboards.json 中
              })),
              prompts: project.prompts,
              debugLog: project.debugLog
          };
          
          const settingsResponse = await fetch(`/api/filesystem/write/${encodeURIComponent(project.id)}/settings.json`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'X-Site-Id': siteId
              },
              body: JSON.stringify({ content: settingsData })
          });
          
          if (!settingsResponse.ok) {
              const errorText = await settingsResponse.text();
              throw new Error(`保存 settings.json 失败: ${settingsResponse.status} ${errorText}`);
          }
          
          // 2. 保存 original.json（原始文本）
          const originalData = {
              fullText: project.fullText
          };
          
          const originalResponse = await fetch(`/api/filesystem/write/${encodeURIComponent(project.id)}/original.json`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'X-Site-Id': siteId
              },
              body: JSON.stringify({ content: originalData })
          });
          
          if (!originalResponse.ok) {
              const errorText = await originalResponse.text();
              throw new Error(`保存 original.json 失败: ${originalResponse.status} ${errorText}`);
          }
          
          // 3. 保存 storyboards.json（分镜数据）
          const storyboardsData = {
              chapters: project.chapters.map(ch => ({
                  id: ch.id,
                  title: ch.title,
                  storyboard: ch.storyboard
              }))
          };
          
          const storyboardsResponse = await fetch(`/api/filesystem/write/${encodeURIComponent(project.id)}/storyboards.json`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'X-Site-Id': siteId
              },
              body: JSON.stringify({ content: storyboardsData })
          });
          
          if (!storyboardsResponse.ok) {
              const errorText = await storyboardsResponse.text();
              throw new Error(`保存 storyboards.json 失败: ${storyboardsResponse.status} ${errorText}`);
          }
          
          console.log(`[API保存] ✓ 项目保存完成: ${project.title}`);
      } catch (e: any) {
          console.error(`[API保存] ✗ 保存项目失败:`, e);
          throw new Error(`通过API保存项目失败: ${e.message || '未知错误'}`);
      }
  },

  /**
   * 通过主项目API删除项目
   */
  async deleteProjectFromMainAPI(projectId: string): Promise<void> {
      try {
          // 获取当前子项目的ID
          const siteId = (import.meta.env.VITE_SITE_ID as string) || '--';
          
          // 调用主项目的删除项目API
          const deleteResponse = await fetch(`/api/filesystem/delete-project/${encodeURIComponent(projectId)}`, {
              method: 'DELETE',
              headers: {
                  'Content-Type': 'application/json',
                  'X-Site-Id': siteId
              }
          });
          
          if (!deleteResponse.ok) {
              const errorText = await deleteResponse.text();
              throw new Error(`删除项目失败: ${deleteResponse.status} ${errorText}`);
          }
          
          const result = await deleteResponse.json();
          if (!result.success) {
              throw new Error(result.error || '删除项目失败');
          }
          
          console.log(`[API删除] ✓ 项目删除成功`);
      } catch (e: any) {
          console.error(`[API删除] ✗ 删除项目失败:`, e);
          throw new Error(`通过API删除项目失败: ${e.message || '未知错误'}`);
      }
  }
};