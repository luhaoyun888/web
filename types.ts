
export interface Project {
  id: string;
  title: string;
  category: string;
  description: string;
  imageUrl: string;
  tags: string[];
  link?: string;
  content?: string;
}

export interface Skill {
  subject: string;
  A: number;
  fullMark: number;
}

export interface TimelineItem {
  year: string;
  title: string;
  description: string;
  icon: string;
}
