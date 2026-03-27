import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAppStore } from '../../stores/appStore';

export const Notes: React.FC = () => {
  const { notes, loadNotes, loadNote, currentNoteContent, saveNote, deleteNote } = useAppStore();
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleSelectNote = async (date: string) => {
    setSelectedNote(date);
    await loadNote(date);
    setEditContent(currentNoteContent);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (selectedNote) {
      await saveNote(selectedNote, editContent);
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (selectedNote && confirm('确定删除这篇笔记吗？')) {
      await deleteNote(selectedNote);
      setSelectedNote(null);
    }
  };

  const handleBack = () => {
    setSelectedNote(null);
    setIsEditing(false);
  };

  if (selectedNote) {
    return (
      <div className="note-view">
        <div className="note-header">
          <button className="btn btn-secondary btn-sm" onClick={handleBack}>
            返回列表
          </button>
          <div className="note-date">
            {format(new Date(selectedNote), 'yyyy年M月d日', { locale: zhCN })}
          </div>
          <div className="note-actions">
            {isEditing ? (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(false)}>取消</button>
                <button className="btn btn-primary btn-sm" onClick={handleSave}>保存</button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  setEditContent(currentNoteContent);
                  setIsEditing(true);
                }}>编辑</button>
                <button className="btn btn-danger btn-sm" onClick={handleDelete}>删除</button>
              </>
            )}
          </div>
        </div>
        
        <div className="note-content">
          {isEditing ? (
            <textarea
              className="note-textarea"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder="在这里写下你的笔记... (支持 Markdown 格式)"
            />
          ) : (
            currentNoteContent ? (
              <div className="note-preview">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {currentNoteContent}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="empty-state">
                <p>暂无内容</p>
                <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setIsEditing(true)}>
                  添加内容
                </button>
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="notes-list">
      {notes.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="64" height="64">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <div className="empty-state-title">暂无笔记</div>
          <p>点击日历上的日期添加笔记</p>
        </div>
      ) : (
        <div className="notes-grid">
          {notes.map(note => (
            <div
              key={note.date}
              className="note-card"
              onClick={() => handleSelectNote(note.date)}
            >
              <div className="note-card-date">
                {format(new Date(note.date), 'M月d日', { locale: zhCN })}
              </div>
              <div className="note-card-preview">
                {note.updated_at ? `${format(new Date(note.updated_at), 'HH:mm')} 更新` : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notes;
