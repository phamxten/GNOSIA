import {
  AlarmClock, ArrowDownUp, ArrowLeft, ArrowRight, Award, BarChart3, Bell, Blocks, BookOpen, Bot, Box, Briefcase, Building2, Bug, Calculator,
  Check, ChevronDown, ChevronRight, ChevronsRight, Chrome, Circle, CircleAlert, CircleArrowRight, CircleCheck, CircleHelp, CircleX, Clapperboard,
  ClipboardCheck, ClipboardPlus, Clock, CloudCheck, CodeXml, Copy, CreditCard, Download, Dumbbell, Eye, ExternalLink, FileDown, Flag, FlaskConical,
  FolderKanban, Gamepad2, GitBranch, GraduationCap, GripVertical, Hand, Hourglass, House, Info, Layers, LayoutDashboard, LayoutGrid, LayoutList,
  Lightbulb, Link, List, ListChecks, Loader, LoaderCircle, Lock, LockOpen, LogOut, Map, MessageCircle, MessageSquare, MessageSquareCode, Monitor,
  Notebook, NotebookPen, Pause, Pencil, Play, Plus, Diff, Puzzle, Quote, Repeat, RotateCcw, Save, School, Search, Send, Settings, Shapes,
  Shield, ShieldCheck, SlidersHorizontal, Smartphone, Sparkles, SquareFunction, Stethoscope, SunMoon, Swords, Target, Terminal, Text, Timer,
  Trash2, TriangleAlert, Type, Upload, User, UserPlus, Users, WifiOff, Wind, X, Zap, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  'alarm-clock': AlarmClock, 'arrow-down-up': ArrowDownUp, 'arrow-left': ArrowLeft, 'arrow-right': ArrowRight, award: Award,
  'chart-no-axes-column': BarChart3, bell: Bell, blocks: Blocks, 'book-open': BookOpen, bot: Bot, box: Box, briefcase: Briefcase,
  'building-2': Building2, bug: Bug, calculator: Calculator, check: Check, 'chevron-down': ChevronDown, 'chevron-right': ChevronRight,
  'chevrons-right': ChevronsRight, chrome: Chrome, circle: Circle, 'circle-alert': CircleAlert, 'arrow-right-circle': CircleArrowRight,
  'circle-check': CircleCheck, 'help-circle': CircleHelp, 'circle-x': CircleX, clapperboard: Clapperboard, 'clipboard-check': ClipboardCheck,
  'clipboard-plus': ClipboardPlus, clock: Clock, 'cloud-check': CloudCheck, 'code-xml': CodeXml, copy: Copy, 'credit-card': CreditCard,
  download: Download, dumbbell: Dumbbell, eye: Eye, 'external-link': ExternalLink, 'file-down': FileDown, flag: Flag, 'flask-conical': FlaskConical,
  'folder-kanban': FolderKanban, 'gamepad-2': Gamepad2, 'git-branch': GitBranch, 'graduation-cap': GraduationCap, 'grip-vertical': GripVertical,
  hand: Hand, hourglass: Hourglass, house: House, info: Info, layers: Layers, 'layout-dashboard': LayoutDashboard, 'layout-grid': LayoutGrid,
  'layout-list': LayoutList, lightbulb: Lightbulb, link: Link, list: List, 'list-checks': ListChecks, loader: Loader, 'loader-circle': LoaderCircle,
  lock: Lock, 'lock-open': LockOpen, 'log-out': LogOut, map: Map, 'message-circle': MessageCircle, 'message-square': MessageSquare,
  'message-square-code': MessageSquareCode, monitor: Monitor, notebook: Notebook, 'notebook-pen': NotebookPen, pause: Pause, pencil: Pencil,
  play: Play, plus: Plus, 'plus-minus': Diff, puzzle: Puzzle, quote: Quote, repeat: Repeat, 'rotate-ccw': RotateCcw, save: Save,
  school: School, search: Search, send: Send, settings: Settings, shapes: Shapes, shield: Shield, 'shield-check': ShieldCheck,
  'sliders-horizontal': SlidersHorizontal, smartphone: Smartphone, sparkles: Sparkles, 'function-square': SquareFunction, stethoscope: Stethoscope,
  'sun-moon': SunMoon, swords: Swords, target: Target, terminal: Terminal, text: Text, timer: Timer, 'trash-2': Trash2, 'triangle-alert': TriangleAlert,
  type: Type, upload: Upload, user: User, 'user-plus': UserPlus, users: Users, 'wifi-off': WifiOff, wind: Wind, x: X, zap: Zap,
};

export const iconNames = Object.keys(ICONS);

type Props = { name: string; size?: 14 | 20; className?: string; style?: React.CSSProperties; title?: string };

/** Lucide icon by its kebab-case name (the names used in the mockups and in content). */
export function Icon({ name, size, className, style, title }: Props) {
  const C = ICONS[name] || Circle;
  const cls = ['lucide', size ? `i-${size}` : '', className || ''].filter(Boolean).join(' ');
  return <C className={cls} style={style} aria-hidden={title ? undefined : true} aria-label={title} strokeWidth={1.75} />;
}
