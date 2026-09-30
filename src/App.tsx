/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { 
  Plus, 
  GripVertical, 
  CheckCircle2, 
  Circle, 
  Tag, 
  User as UserIcon, 
  MoreHorizontal,
  ChevronRight,
  X,
  Search,
  LayoutList,
  LayoutGrid,
  Calendar,
  Settings,
  Inbox,
  Star,
  Clock,
  Moon,
  Sun,
  Hash,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { ProjectState, Group, Task, User, Priority } from './types';

// --- Initial Data ---
const INITIAL_STATE: ProjectState = {
  id: 'p1',
  title: 'Productivity Hub',
  nextGlobalId: 5,
  users: [
    { id: 'u1', name: 'Alex Rivera' },
    { id: 'u2', name: 'Sarah Chen' },
  ],
  groups: [
    { id: 'g1', title: 'To Do', taskIds: ['t1', 't2'] },
    { id: 'g2', title: 'In Progress', taskIds: ['t3', 't4'] },
  ],
  tasks: {
    't1': { id: 't1', globalId: 1, title: 'Design System Audit', completed: false, priority: 'High', tags: ['Design'], groupId: 'g1', assigneeId: 'u1' },
    't2': { id: 't2', globalId: 2, title: 'API Documentation', completed: true, priority: 'Medium', tags: ['Backend'], groupId: 'g1', assigneeId: 'u2' },
    't3': { id: 't3', globalId: 3, title: 'User Interview Analysis', completed: false, priority: 'Critical', tags: ['Research'], groupId: 'g2', assigneeId: 'u1' },
    't4': { id: 't4', globalId: 4, title: 'Marketing Landing Page', completed: false, priority: 'High', tags: ['Frontend'], groupId: 'g2' },
  }
};

// --- Components ---

interface SortableItemProps {
  id: string;
  children?: React.ReactNode;
  className?: string;
}

const SortableItem = ({ id, children, className }: SortableItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("group/item relative", className)}>
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 cursor-grab active:cursor-grabbing p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-all"
      >
        <GripVertical className="w-3 h-3 text-slate-400" />
      </div>
      {children}
    </div>
  );
};

export default function App() {
  const [state, setState] = useState<ProjectState>(INITIAL_STATE);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isModalCollapsed, setIsModalCollapsed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // --- Handlers ---

  const toggleTaskCompletion = useCallback((taskId: string) => {
    setState(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [taskId]: {
          ...prev.tasks[taskId],
          completed: !prev.tasks[taskId].completed
        }
      }
    }));
  }, []);

  const addTask = (groupId: string) => {
    const newId = `t${Math.random().toString(36).substr(2, 9)}`;
    const globalId = state.nextGlobalId;
    const newTask: Task = {
      id: newId,
      globalId,
      title: '',
      completed: false,
      priority: 'Medium',
      tags: [],
      groupId
    };

    setState(prev => ({
      ...prev,
      nextGlobalId: prev.nextGlobalId + 1,
      tasks: { ...prev.tasks, [newId]: newTask },
      groups: prev.groups.map(g => g.id === groupId ? { ...g, taskIds: [...g.taskIds, newId] } : g)
    }));
    
    setSelectedTaskId(newId);
    setIsModalCollapsed(false);
  };

  const deleteTask = (taskId: string) => {
    const task = state.tasks[taskId];
    if (!task) return;
    
    setState(prev => {
      const newTasks = { ...prev.tasks };
      delete newTasks[taskId];
      
      return {
        ...prev,
        tasks: newTasks,
        groups: prev.groups.map(g => g.id === task.groupId ? { ...g, taskIds: g.taskIds.filter(id => id !== taskId) } : g)
      };
    });
    setSelectedTaskId(null);
  };

  const updateTaskDescription = (taskId: string, description: string) => {
    setState(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [taskId]: { ...prev.tasks[taskId], description }
      }
    }));
  };

  const copyTaskLink = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?task=${taskId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied!');
    });
  };

  const addGroup = () => {
    const newId = `g${Math.random().toString(36).substr(2, 9)}`;
    const newGroup: Group = {
      id: newId,
      title: 'New Group',
      taskIds: []
    };
    setState(prev => ({
      ...prev,
      groups: [...prev.groups, newGroup]
    }));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const activeTask = state.tasks[activeId];
    if (!activeTask) return;
    const activeContainer = activeTask.groupId;
    let overContainer = state.groups.find(g => g.id === overId)?.id;
    if (!overContainer) {
      const overTask = state.tasks[overId];
      if (overTask) overContainer = overTask.groupId;
    }
    if (!overContainer || activeContainer === overContainer) return;
    setState(prev => {
      const activeGroup = prev.groups.find(g => g.id === activeContainer);
      const overGroup = prev.groups.find(g => g.id === overContainer);
      if (!activeGroup || !overGroup) return prev;
      const activeTaskIds = [...activeGroup.taskIds];
      const overTaskIds = [...overGroup.taskIds];
      const activeIndex = activeTaskIds.indexOf(activeId);
      activeTaskIds.splice(activeIndex, 1);
      const overIndex = overTaskIds.indexOf(overId);
      const newIndex = overIndex >= 0 ? overIndex : overTaskIds.length;
      overTaskIds.splice(newIndex, 0, activeId);
      return {
        ...prev,
        tasks: {
          ...prev.tasks,
          [activeId]: { ...prev.tasks[activeId], groupId: overContainer! }
        },
        groups: prev.groups.map(g => {
          if (g.id === activeContainer) return { ...g, taskIds: activeTaskIds };
          if (g.id === overContainer) return { ...g, taskIds: overTaskIds };
          return g;
        })
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    if (active.id !== over.id) {
      const activeId = active.id as string;
      const overId = over.id as string;
      const activeGroupIndex = state.groups.findIndex(g => g.id === activeId);
      const overGroupIndex = state.groups.findIndex(g => g.id === overId);
      if (activeGroupIndex !== -1 && overGroupIndex !== -1) {
        setState(prev => ({
          ...prev,
          groups: arrayMove(prev.groups, activeGroupIndex, overGroupIndex)
        }));
      } else {
        const activeTask = state.tasks[activeId];
        const overTask = state.tasks[overId];
        if (activeTask && overTask && activeTask.groupId === overTask.groupId) {
          const group = state.groups.find(g => g.id === activeTask.groupId);
          if (group) {
            const oldIndex = group.taskIds.indexOf(activeId);
            const newIndex = group.taskIds.indexOf(overId);
            setState(prev => ({
              ...prev,
              groups: prev.groups.map(g => 
                g.id === group.id 
                  ? { ...g, taskIds: arrayMove(g.taskIds, oldIndex, newIndex) } 
                  : g
              )
            }));
          }
        }
      }
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const updateAssignee = (taskId: string, userId: string | 'new') => {
    if (userId === 'new') {
      const name = prompt('Enter new member name:');
      if (name) {
        const newUserId = `u${Math.random().toString(36).substr(2, 9)}`;
        const newUser: User = { id: newUserId, name };
        setState(prev => ({
          ...prev,
          users: [...prev.users, newUser],
          tasks: {
            ...prev.tasks,
            [taskId]: { ...prev.tasks[taskId], assigneeId: newUserId }
          }
        }));
      }
      return;
    }
    setState(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [taskId]: { ...prev.tasks[taskId], assigneeId: userId }
      }
    }));
  };

  const handleModalMouseLeave = (e: React.MouseEvent) => {
    if (e.clientX < window.innerWidth / 2) {
      setIsModalCollapsed(true);
    }
  };

  const selectedTask = selectedTaskId ? state.tasks[selectedTaskId] : null;

  return (
    <div className={cn(
      "flex h-screen overflow-hidden bg-paper text-ink transition-colors duration-300",
      isDarkMode && "dark"
    )}>
      {/* Sidebar */}
      <aside className="w-64 border-r border-border-subtle dark:border-border-subtle-dark flex flex-col p-6 gap-8 bg-paper dark:bg-paper-dark transition-all">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-ink dark:bg-ink-dark rounded flex items-center justify-center">
              <div className="w-2 h-2 bg-paper dark:bg-paper-dark rounded-full" />
            </div>
            <span className="font-serif italic font-medium text-lg tracking-tight">Editorial</span>
          </div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-slate-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
          </button>
        </div>

        <div className="space-y-8 flex-1 overflow-y-auto custom-scrollbar">
          <section className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 px-2 mb-2">Workspace</p>
            {[
              { icon: Inbox, label: 'Inbox', count: 12 },
              { icon: Star, label: 'Favorites' },
              { icon: Clock, label: 'Recent' },
              { icon: LayoutList, label: 'All Tasks', active: true },
            ].map((item) => (
              <button
                key={item.label}
                className={cn(
                  "w-full flex items-center justify-between p-2 rounded-lg transition-all duration-200 group",
                  item.active 
                    ? "bg-black/5 dark:bg-white/5 text-ink dark:text-ink-dark" 
                    : "text-slate-500 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] hover:text-ink dark:hover:text-ink-dark"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                {item.count && (
                  <span className="text-[10px] font-bold text-slate-400">{item.count}</span>
                )}
              </button>
            ))}
          </section>

          <section className="space-y-1">
            <div className="flex items-center justify-between px-2 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Projects</p>
              <button className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors">
                <Plus className="w-3 h-3 text-slate-400" />
              </button>
            </div>
            {[
              { label: 'Design System', color: 'bg-blue-500' },
              { label: 'Marketing Site', color: 'bg-emerald-500' },
              { label: 'Mobile App', color: 'bg-rose-500' },
            ].map((project) => (
              <button
                key={project.label}
                className="w-full flex items-center gap-3 p-2 rounded-lg text-slate-500 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] hover:text-ink dark:hover:text-ink-dark transition-all group"
              >
                <div className={cn("w-1.5 h-1.5 rounded-full", project.color)} />
                <span className="text-sm font-medium">{project.label}</span>
              </button>
            ))}
          </section>
        </div>

        <div className="pt-6 border-t border-border-subtle dark:border-border-subtle-dark">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold">
              AR
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">Alex Rivera</p>
              <p className="text-[10px] text-slate-400 truncate">Pro Plan</p>
            </div>
            <Settings className="w-4 h-4 text-slate-400 cursor-pointer hover:text-ink dark:hover:text-ink-dark transition-colors" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-paper dark:bg-paper-dark overflow-hidden">
        {/* Header */}
        <header className="px-8 py-6 border-b border-border-subtle dark:border-border-subtle-dark flex items-center justify-between shrink-0">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <span>Workspace</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-ink dark:text-ink-dark">{state.title}</span>
            </div>
            <h1 className="text-4xl font-serif font-medium tracking-tight mt-2">{state.title}</h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1 border-r border-border-subtle dark:border-border-subtle-dark pr-6">
              <button 
                onClick={() => setView('list')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                  view === 'list' ? "bg-black/5 dark:bg-white/5 text-ink dark:text-ink-dark" : "text-slate-400 hover:text-ink dark:hover:text-ink-dark"
                )}
              >
                <LayoutList className="w-3.5 h-3.5" />
                List
              </button>
              <button 
                onClick={() => setView('board')}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all",
                  view === 'board' ? "bg-black/5 dark:bg-white/5 text-ink dark:text-ink-dark" : "text-slate-400 hover:text-ink dark:hover:text-ink-dark"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Board
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button className="p-2 text-slate-400 hover:text-ink dark:hover:text-ink-dark transition-colors">
                <Filter className="w-4 h-4" />
              </button>
              <button className="p-2 text-slate-400 hover:text-ink dark:hover:text-ink-dark transition-colors">
                <ArrowUpDown className="w-4 h-4" />
              </button>
              <button className="p-2 text-slate-400 hover:text-ink dark:hover:text-ink-dark transition-colors">
                <Search className="w-4 h-4" />
              </button>
              <button 
                onClick={addGroup}
                className="ml-2 px-4 py-2 border border-border-subtle dark:border-border-subtle-dark text-ink dark:text-ink-dark rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-black/5 dark:hover:bg-white/5 transition-all"
              >
                New Group
              </button>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="px-8 border-b border-border-subtle dark:border-border-subtle-dark flex items-center gap-8 shrink-0">
          {['Tasks', 'Notes', 'Files', 'Timeline'].map((tab) => (
            <button
              key={tab}
              className={cn(
                "py-4 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all",
                tab === 'Tasks' ? "border-ink dark:border-ink-dark text-ink dark:text-ink-dark" : "border-transparent text-slate-400 hover:text-ink dark:hover:text-ink-dark"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-8">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {view === 'list' ? (
              <div className="h-full overflow-y-auto pr-2 custom-scrollbar space-y-12 pb-24">
                <SortableContext items={state.groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                  {state.groups.map((group) => (
                    <section key={group.id} className="space-y-6">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-4">
                          <input 
                            type="text"
                            value={group.title}
                            onChange={(e) => {
                              const newTitle = e.target.value;
                              setState(prev => ({
                                ...prev,
                                groups: prev.groups.map(g => g.id === group.id ? { ...g, title: newTitle } : g)
                              }));
                            }}
                            className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 bg-transparent border-none focus:ring-0 p-0 outline-none w-auto min-w-[100px]"
                          />
                          <span className="text-[10px] font-bold text-slate-300">{group.taskIds.length}</span>
                        </div>
                        <button 
                          onClick={() => addTask(group.id)}
                          className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>

                      <div className="flex flex-col border-t border-border-subtle dark:border-border-subtle-dark">
                        <SortableContext items={group.taskIds} strategy={verticalListSortingStrategy}>
                          {group.taskIds.map((taskId) => {
                            const task = state.tasks[taskId];
                            if (!task) return null;
                            const assignee = state.users.find(u => u.id === task.assigneeId);

                            return (
                              <motion.div
                                layoutId={task.id}
                                key={task.id}
                                onClick={() => setSelectedTaskId(task.id)}
                                className={cn(
                                  "group flex items-center gap-6 py-4 pl-8 pr-2 border-b border-border-subtle dark:border-border-subtle-dark cursor-pointer transition-all hover:bg-black/[0.01] dark:hover:bg-white/[0.01]",
                                  selectedTaskId === task.id && "bg-black/[0.02] dark:bg-white/[0.02]",
                                  task.completed && "opacity-40"
                                )}
                              >
                                <div className="flex items-center gap-4">
                                  <SortableItem id={task.id} className="flex items-center" />
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleTaskCompletion(task.id);
                                    }}
                                    className={cn(
                                      "w-5 h-5 rounded border transition-all flex items-center justify-center",
                                      task.completed 
                                        ? "bg-ink dark:bg-ink-dark border-ink dark:border-ink-dark text-paper dark:text-paper-dark" 
                                        : "border-border-subtle dark:border-border-subtle-dark hover:border-ink dark:hover:border-ink-dark"
                                    )}
                                  >
                                    {task.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                                  </button>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <h3 className={cn(
                                    "text-sm font-medium transition-all",
                                    task.completed ? "text-slate-400 line-through" : "text-ink dark:text-ink-dark"
                                  )}>
                                    {task.title || 'Untitled Task'}
                                  </h3>
                                </div>

                                <div className="flex items-center gap-8 shrink-0">
                                  <div className="flex items-center gap-2">
                                    {task.tags.slice(0, 2).map(tag => (
                                      <span key={tag} className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[10px] font-bold text-slate-500">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>

                                  <span className={cn(
                                    "w-20 text-[10px] font-bold uppercase tracking-widest text-right",
                                    task.priority === 'Critical' && "text-rose-500",
                                    task.priority === 'High' && "text-orange-500",
                                    task.priority === 'Medium' && "text-blue-500",
                                    task.priority === 'Low' && "text-slate-400",
                                  )}>
                                    {task.priority}
                                  </span>

                                  <div className="w-24 flex justify-end">
                                    {assignee ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400">{assignee.name.split(' ')[0]}</span>
                                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                                          {assignee.name.charAt(0)}
                                        </div>
                                      </div>
                                    ) : (
                                      <UserIcon className="w-4 h-4 text-slate-200 dark:text-slate-800" />
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </SortableContext>
                        <button 
                          onClick={() => addTask(group.id)}
                          className="group flex items-center gap-4 py-4 px-2 text-slate-400 hover:text-ink dark:hover:text-ink-dark transition-all"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-sm font-medium">Add task</span>
                        </button>
                      </div>
                    </section>
                  ))}
                </SortableContext>
              </div>
            ) : (
              <div className="h-full overflow-x-auto pb-12 flex gap-8 items-start custom-scrollbar">
                <SortableContext items={state.groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                  {state.groups.map((group) => (
                    <div key={group.id} className="w-80 shrink-0 flex flex-col max-h-full gap-6">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-4">
                          <input 
                            type="text"
                            value={group.title}
                            onChange={(e) => {
                              const newTitle = e.target.value;
                              setState(prev => ({
                                ...prev,
                                groups: prev.groups.map(g => g.id === group.id ? { ...g, title: newTitle } : g)
                              }));
                            }}
                            className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 bg-transparent border-none focus:ring-0 p-0 outline-none w-auto min-w-[100px]"
                          />
                          <span className="text-[10px] font-bold text-slate-300">{group.taskIds.length}</span>
                        </div>
                        <button 
                          onClick={() => addTask(group.id)}
                          className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        <SortableContext items={group.taskIds} strategy={verticalListSortingStrategy}>
                          {group.taskIds.map((taskId) => {
                            const task = state.tasks[taskId];
                            if (!task) return null;
                            const assignee = state.users.find(u => u.id === task.assigneeId);

                            return (
                              <motion.div 
                                layoutId={task.id}
                                key={task.id}
                                onClick={() => setSelectedTaskId(task.id)}
                                className={cn(
                                  "group bg-paper dark:bg-paper-dark p-5 rounded-xl border border-border-subtle dark:border-border-subtle-dark editorial-shadow cursor-pointer transition-all hover:border-ink dark:hover:border-ink-dark relative",
                                  selectedTaskId === task.id && "border-ink dark:border-ink-dark ring-1 ring-ink dark:ring-ink-dark",
                                  task.completed && "opacity-40"
                                )}
                              >
                                <div className="flex items-start justify-between mb-4">
                                  <span className="text-[10px] font-bold text-slate-300 tracking-widest uppercase">Task-{task.globalId}</span>
                                  <div className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    task.priority === 'Critical' && "bg-rose-500",
                                    task.priority === 'High' && "bg-orange-500",
                                    task.priority === 'Medium' && "bg-blue-500",
                                    task.priority === 'Low' && "bg-slate-300",
                                  )} />
                                </div>
                                <h3 className={cn(
                                  "text-sm font-medium mb-6 leading-relaxed",
                                  task.completed ? "text-slate-400 line-through" : "text-ink dark:text-ink-dark"
                                )}>
                                  {task.title || 'Untitled Task'}
                                </h3>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {assignee ? (
                                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                                        {assignee.name.charAt(0)}
                                      </div>
                                    ) : (
                                      <div className="w-6 h-6 rounded-full border border-dashed border-border-subtle dark:border-border-subtle-dark flex items-center justify-center">
                                        <UserIcon className="w-3 h-3 text-slate-300" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    {task.tags.slice(0, 1).map(tag => (
                                      <span key={tag} className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[9px] font-bold text-slate-500">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </SortableContext>
                        <button 
                          onClick={() => addTask(group.id)}
                          className="w-full py-3 rounded-xl text-slate-400 hover:text-ink dark:hover:text-ink-dark hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-2"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          New
                        </button>
                      </div>
                    </div>
                  ))}
                </SortableContext>
                <button 
                  onClick={addGroup}
                  className="w-80 shrink-0 h-12 rounded-xl border border-dashed border-border-subtle dark:border-border-subtle-dark text-slate-400 hover:text-ink dark:hover:text-ink-dark hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-all flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                >
                  <Plus className="w-4 h-4" />
                  New Column
                </button>
              </div>
            )}
          </DndContext>
        </div>

        {/* Task Detail Panel */}
        <AnimatePresence>
          {selectedTaskId && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedTaskId(null)}
                className="absolute inset-0 bg-slate-900/5 backdrop-blur-sm z-40"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: isModalCollapsed ? '95%' : 0 }}
                exit={{ x: '100%' }}
                onMouseLeave={handleModalMouseLeave}
                onMouseEnter={() => setIsModalCollapsed(false)}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className={cn(
                  "absolute top-4 right-4 bottom-4 w-[90%] md:w-[500px] bg-paper dark:bg-paper-dark border border-border-subtle dark:border-border-subtle-dark rounded-3xl z-50 flex flex-col overflow-hidden transition-opacity duration-300 editorial-shadow",
                  isModalCollapsed && "opacity-40 hover:opacity-100"
                )}
              >
                <div className="p-8 flex flex-col h-full gap-8">
                  <div className="flex items-center justify-between">
                    <button 
                      onClick={() => toggleTaskCompletion(selectedTaskId)}
                      className={cn(
                        "flex items-center gap-3 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                        selectedTask?.completed 
                          ? "bg-ink dark:bg-ink-dark text-paper dark:text-paper-dark border-ink dark:border-ink-dark" 
                          : "bg-transparent text-slate-500 border-border-subtle dark:border-border-subtle-dark hover:border-ink dark:hover:border-ink-dark"
                      )}
                    >
                      {selectedTask?.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                      {selectedTask?.completed ? 'Completed' : 'Mark Complete'}
                    </button>
                    
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => deleteTask(selectedTaskId)}
                        className="p-3 rounded-xl border border-border-subtle dark:border-border-subtle-dark text-slate-400 hover:text-rose-500 hover:border-rose-500 transition-all"
                        title="Delete Task"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setSelectedTaskId(null)}
                        className="p-3 rounded-xl border border-border-subtle dark:border-border-subtle-dark text-slate-400 hover:text-ink dark:hover:text-ink-dark transition-all"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-8">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Task Title</p>
                      <input 
                        type="text" 
                        value={selectedTask?.title || ''}
                        onChange={(e) => {
                          const newTitle = e.target.value;
                          setState(prev => ({
                            ...prev,
                            tasks: {
                              ...prev.tasks,
                              [selectedTaskId]: { ...prev.tasks[selectedTaskId], title: newTitle }
                            }
                          }));
                        }}
                        className="text-2xl font-serif font-medium text-ink dark:text-ink-dark bg-transparent border-none focus:ring-0 w-full p-0 placeholder:text-slate-300 outline-none"
                        placeholder="What needs to be done?"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Assignee</p>
                        <div className="relative">
                          <select 
                            value={selectedTask?.assigneeId || ''}
                            onChange={(e) => updateAssignee(selectedTaskId, e.target.value)}
                            className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-border-subtle dark:border-border-subtle-dark rounded-xl px-4 py-3 text-xs font-bold text-ink dark:text-ink-dark appearance-none outline-none cursor-pointer hover:border-ink dark:hover:border-ink-dark transition-all uppercase tracking-widest"
                          >
                            <option value="">Unassigned</option>
                            {state.users.map(u => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                            <option value="new">+ Add New</option>
                          </select>
                          <ChevronRight className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Priority</p>
                        <div className="relative">
                          <select 
                            value={selectedTask?.priority || 'Medium'}
                            onChange={(e) => {
                              const priority = e.target.value as Priority;
                              setState(prev => ({
                                ...prev,
                                tasks: {
                                  ...prev.tasks,
                                  [selectedTaskId]: { ...prev.tasks[selectedTaskId], priority }
                                }
                              }));
                            }}
                            className="w-full bg-black/[0.02] dark:bg-white/[0.02] border border-border-subtle dark:border-border-subtle-dark rounded-xl px-4 py-3 text-xs font-bold text-ink dark:text-ink-dark appearance-none outline-none cursor-pointer hover:border-ink dark:hover:border-ink-dark transition-all uppercase tracking-widest"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                          </select>
                          <ChevronRight className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Tags</p>
                      <div className="flex flex-wrap gap-3">
                        {selectedTask?.tags.map(tag => (
                          <span key={tag} className="bg-black/[0.02] dark:bg-white/[0.02] border border-border-subtle dark:border-border-subtle-dark px-4 py-2 rounded-xl text-[10px] font-bold text-slate-500 flex items-center gap-2 uppercase tracking-widest">
                            {tag}
                            <button 
                              onClick={() => {
                                setState(prev => ({
                                  ...prev,
                                  tasks: {
                                    ...prev.tasks,
                                    [selectedTaskId]: {
                                      ...prev.tasks[selectedTaskId],
                                      tags: prev.tasks[selectedTaskId].tags.filter(t => t !== tag)
                                    }
                                  }
                                }));
                              }}
                              className="hover:text-rose-500 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                        <button 
                          onClick={() => {
                            const tag = prompt('Enter new tag:');
                            if (tag) {
                              setState(prev => ({
                                ...prev,
                                tasks: {
                                  ...prev.tasks,
                                  [selectedTaskId]: {
                                    ...prev.tasks[selectedTaskId],
                                    tags: [...prev.tasks[selectedTaskId].tags, tag]
                                  }
                                }
                              }));
                            }
                          }}
                          className="px-4 py-2 rounded-xl border border-dashed border-border-subtle dark:border-border-subtle-dark text-[10px] font-bold text-slate-400 hover:text-ink dark:hover:text-ink-dark hover:border-ink dark:hover:border-ink-dark transition-all uppercase tracking-widest"
                        >
                          + Add Tag
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Description</p>
                      <textarea 
                        value={selectedTask?.description || ''}
                        onChange={(e) => updateTaskDescription(selectedTaskId, e.target.value)}
                        className="w-full bg-black/[0.01] dark:bg-white/[0.01] border border-border-subtle dark:border-border-subtle-dark rounded-2xl p-6 text-sm text-ink dark:text-ink-dark min-h-[150px] outline-none focus:border-ink dark:focus:border-ink-dark transition-all resize-none placeholder:text-slate-300"
                        placeholder="Add more details about this task..."
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border-subtle dark:border-border-subtle-dark flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Clock className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Created 2 hours ago</span>
                    </div>
                    <button 
                      onClick={(e) => copyTaskLink(e, selectedTaskId)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border-subtle dark:border-border-subtle-dark text-[10px] font-bold text-slate-500 hover:text-ink dark:hover:text-ink-dark hover:border-ink dark:hover:border-ink-dark transition-all uppercase tracking-widest"
                    >
                      <ArrowUpDown className="w-3 h-3 rotate-90" />
                      Copy Link
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
