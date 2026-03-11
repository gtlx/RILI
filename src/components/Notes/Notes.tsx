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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', height: 'calc(100vh - 160px)' }}>
      <div className="card" style={{ overflow: 'auto' }}>
        <div className="card-header">
          <div className="card-title">笔记列表</div>
        </div>
        {notes.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            <div className="empty-state-title">暂无笔记</div>
            <p>点击日历上的日期添加笔记</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {notes.map(note => (
              <div
                key={note.date}
                className={`transaction-item ${selectedNote === note.date ? 'active' : ''}`}
                onClick={() => handleSelectNote(note.date)}
                style={{ 
                  cursor: 'pointer',
                  borderColor: selectedNote === note.date ? '#4F46E5' : undefined,
                  background: selectedNote === note.date ? '#EEF2FF' : undefined
                }}
              >
                <div className="transaction-details">
                  <div className="transaction-category">
                    {format(new Date(note.date), 'yyyy年M月d日', { locale: zhCN })}
                  </div>
                  <div className="transaction-note">
                    {note.updated_at ? `更新于 ${format(new Date(note.updated_at), 'MM-dd HH:mm')}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedNote ? (
          <>
            <div className="card-header">
              <div className="card-title">
                {format(new Date(selectedNote), 'yyyy年M月d日', { locale: zhCN })}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
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
            
            <div style={{ flex: 1, overflow: 'auto' }}>
              {isEditing ? (
                <div className="note-editor" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div className="note-toolbar">
                    <button className="note-toolbar-btn" onClick={() => {
                      const textarea = document.querySelector('.note-textarea') as HTMLTextAreaElement;
                      if (!textarea) return;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const text = editContent;
                      const newText = text.substring(0, start) + '**' + text.substring(start, end) + '**' + text.substring(end);
                      setEditContent(newText);
                    }} title="粗体">
                      <strong>B</strong>
                    </button>
                    <button className="note-toolbar-btn" onClick={() => {
                      const textarea = document.querySelector('.note-textarea') as HTMLTextAreaElement;
                      if (!textarea) return;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const text = editContent;
                      const newText = text.substring(0, start) + '*' + text.substring(start, end) + '*' + text.substring(end);
                      setEditContent(newText);
                    }} title="斜体">
                      <em>I</em>
                    </button>
                    <button className="note-toolbar-btn" onClick={() => setEditContent(editContent + '\n## ')} title="标题">
                      H
                    </button>
                    <button className="note-toolbar-btn" onClick={() => setEditContent(editContent + '\n- ')} title="列表">
                      •
                    </button>
                    <button className="note-toolbar-btn" onClick={() => setEditContent(editContent + '\n[链接](url)')} title="链接">
                      🔗
                    </button>
                    <button className="note-toolbar-btn" onClick={() => setEditContent(editContent + '\n```\n代码块\n```')} title="代码">
                      {'</>'}
                    </button>
                  </div>
                  <textarea
                    className="note-textarea"
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    style={{ flex: 1 }}
                    placeholder="在这里写下你的笔记... (支持 Markdown 格式)"
                  />
                </div>
              ) : (
                <div className="note-preview">
                  {currentNoteContent ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {currentNoteContent}
                    </ReactMarkdown>
                  ) : (
                    <div className="empty-state">
                      <p>暂无内容</p>
                      <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setIsEditing(true)}>
                        添加内容
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="64" height="64">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
            <div className="empty-state-title">选择一篇笔记</div>
            <p>从左侧列表选择一篇笔记查看</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notes;
