
import { Project, Skill, TimelineItem } from './types';

export const SKILLS: Skill[] = [
  { subject: '视觉艺术', A: 85, fullMark: 100 },
  { subject: 'Python/脚本', A: 95, fullMark: 100 },
  { subject: '3D 建模', A: 70, fullMark: 100 },
  { subject: 'AI 工作流', A: 90, fullMark: 100 },
  { subject: 'UI/UX 设计', A: 75, fullMark: 100 },
  { subject: '实时渲染', A: 80, fullMark: 100 },
];

export const PROJECTS: Project[] = [
  {
    id: 'av-01',
    title: '赛博跑车 360',
    category: '汽车视觉',
    description: '一个完全交互式的基于 WebGL 的车辆查看器，支持动态光照和程序化材质切换。',
    imageUrl: '/images/projects/car1.jpg',
    tags: ['WebGL', 'Three.js', 'React'],
  },
  {
    id: 'ai-01',
    title: 'ComfyUI Flux 工作流',
    category: 'AI 实验室',
    description: '使用 Stable Diffusion 和 ControlNet 集成优化的规模化纹理生成工作流。',
    imageUrl: '/images/projects/ai1.jpg',
    tags: ['Stable Diffusion', 'ComfyUI', 'Python'],
  },
  {
    id: 'dev-01',
    title: '资源提取流水线',
    category: '技术日志',
    description: '我如何自动化提取并重新优化高保定游戏资源，以便在移动端部署。',
    imageUrl: '/images/projects/dev1.jpg',
    tags: ['C++', 'Python', 'Unity'],
  }
];

export const TIMELINE: TimelineItem[] = [
  { year: '2024', title: '高级技术美术师', description: '领导 AI 驱动的视觉制作流水线。', icon: 'Zap' },
  { year: '2022', title: '汽车可视化负责人', description: '专注于实时光线追踪汽车配置器。', icon: 'Car' },
  { year: '2020', title: '游戏开发与工具架构师', description: '为大型游戏工作室开发内部 DCC 工具。', icon: 'Code' },
  { year: '2018', title: '视觉传达', description: '视觉艺术学士学位，以优异成绩毕业。', icon: 'PenTool' },
];
