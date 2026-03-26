import React, { useState, useEffect, useRef } from 'react';
import { FiMessageCircle, FiSend, FiUser, FiX, FiTrash2, FiEdit2, FiCornerDownRight, FiUsers, FiUserMinus, FiUserPlus } from 'react-icons/fi';
import { chatAPI } from '../services/api';

/** If this is shorter than a typical server response, requests pile up (Network tab spam + slowness). */
const POLL_INTERVAL = 12000;

const formatTime = (date) => {
  const d = new Date(date);
  const now = new Date();
  const day = d.toDateString();
  const today = now.toDateString();
  if (day === today) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatDateLabel = (date) => {
  const d = new Date(date);
  const now = new Date();
  const day = d.toDateString();
  const today = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === today) return 'Today';
  if (day === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
};

const CommunityChat = ({ currentUser, onClose, initialChatWithUser, onUnreadChange }) => {
  const [tab, setTab] = useState(initialChatWithUser ? 'private' : 'public'); // 'public' | 'private' | 'group'
  const [publicMessages, setPublicMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [showAddMemberPicker, setShowAddMemberPicker] = useState(false);
  const [kickingUserId, setKickingUserId] = useState(null);
  const [addingUserId, setAddingUserId] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { msg, x, y }
  const [editingMessage, setEditingMessage] = useState(null); // { msg, content }
  const [replyingTo, setReplyingTo] = useState(null); // { msg }
  const longPressTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollRef = useRef(null);
  const composerStackRef = useRef(null);
  /** Prevents overlapping polls when the server is slower than POLL_INTERVAL */
  const pollInFlightRef = useRef(false);

  /** iOS/Android: pin composer above keyboard; --chat-kb-inset = gap below visual viewport */
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return undefined;

    const syncViewport = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--chat-kb-inset', `${inset}px`);
      root.style.setProperty('--chat-vvh', `${vv.height}px`);
    };

    syncViewport();
    vv.addEventListener('resize', syncViewport);
    vv.addEventListener('scroll', syncViewport);
    return () => {
      vv.removeEventListener('resize', syncViewport);
      vv.removeEventListener('scroll', syncViewport);
      root.style.removeProperty('--chat-kb-inset');
      root.style.removeProperty('--chat-vvh');
    };
  }, []);

  /** Reserve in-flow height so messages aren’t hidden behind fixed composer (mobile) */
  useEffect(() => {
    const el = composerStackRef.current;
    const root = document.documentElement;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;

    const apply = () => {
      if (!window.matchMedia('(max-width: 768px)').matches) {
        root.style.removeProperty('--chat-composer-spacer');
        return;
      }
      const h = Math.ceil(el.getBoundingClientRect().height);
      root.style.setProperty('--chat-composer-spacer', `${Math.max(72, h)}px`);
    };

    const ro = new ResizeObserver(apply);
    ro.observe(el);
    apply();
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
      root.style.removeProperty('--chat-composer-spacer');
    };
  }, [replyingTo, tab, selectedConversation]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const fetchPublicMessages = async () => {
    try {
      const data = await chatAPI.getPublicMessages();
      setPublicMessages(data);
    } catch (err) {
      console.error('Failed to fetch public messages:', err);
    }
  };

  const fetchConversations = async () => {
    try {
      const data = await chatAPI.getConversations();
      setConversations(data);
      const total = data.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      onUnreadChange?.(total);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    }
  };

  const fetchPrivateMessages = async (convId) => {
    if (!convId) return;
    try {
      const data = await chatAPI.getConversationMessages(convId);
      setPrivateMessages(data);
      fetchConversations();
    } catch (err) {
      console.error('Failed to fetch private messages:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await chatAPI.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchPublicMessages();
    fetchConversations();
    fetchUsers();
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialChatWithUser?._id) return;
    const openChat = async () => {
      setTab('private');
      try {
        const conv = await chatAPI.createConversation(initialChatWithUser._id);
        const list = conv.participants || [];
        const myId = currentUser?._id?.toString?.() || currentUser?.id;
        const other = list.find((p) => (p._id?.toString?.() || p._id) !== myId) || initialChatWithUser;
        setConversations((prev) => {
          const exists = prev.some((c) => c._id === conv._id);
          if (exists) return prev;
          return [{ _id: conv._id, otherUser: other }, ...prev];
        });
        setSelectedConversation({ _id: conv._id, otherUser: other });
      } catch (err) {
        console.error('Failed to open chat:', err);
      }
    };
    openChat();
  }, [initialChatWithUser?._id]);

  useEffect(() => {
    if (selectedConversation) {
      fetchPrivateMessages(selectedConversation._id);
    } else {
      setPrivateMessages([]);
    }
  }, [selectedConversation]);

  useEffect(() => {
    const runPoll = async () => {
      if (document.visibilityState === 'hidden') return;
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        if (tab === 'public') {
          await fetchPublicMessages();
        } else {
          await fetchConversations();
          if (selectedConversation?._id) {
            await fetchPrivateMessages(selectedConversation._id);
          }
        }
      } finally {
        pollInFlightRef.current = false;
      }
    };
    const id = setInterval(runPoll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [tab, selectedConversation]);

  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    prevMsgCountRef.current = 0;
  }, [tab, selectedConversation?._id]);
  useEffect(() => {
    const count = (tab === 'public' ? publicMessages : privateMessages).length;
    if (count > prevMsgCountRef.current) {
      scrollToBottom();
    }
    prevMsgCountRef.current = count;
  }, [publicMessages, privateMessages, tab]);

  const handleSendPublic = async (e) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const replyToId = replyingTo?.msg?._id;
      const msg = await chatAPI.sendPublicMessage(text, replyToId);
      setPublicMessages((prev) => [...prev, msg]);
      setInputValue('');
      setReplyingTo(null);
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setSending(false);
    }
  };

  const handleSendPrivate = async (e) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || sending || !selectedConversation?._id) return;
    setSending(true);
    try {
      const replyToId = replyingTo?.msg?._id;
      const msg = await chatAPI.sendPrivateMessage(selectedConversation._id, text, replyToId);
      setPrivateMessages((prev) => [...prev, msg]);
      setInputValue('');
      setReplyingTo(null);
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteConversation = async (convId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Delete this chat? All messages will be permanently removed.')) return;
    setDeleting(true);
    try {
      await chatAPI.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c._id !== convId));
      if (selectedConversation?._id === convId) {
        setSelectedConversation(null);
        setPrivateMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Failed to delete chat');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteMessage = async (msg) => {
    setContextMenu(null);
    if (!isOwnMessage(msg)) return;
    if (!window.confirm('Delete this message?')) return;
    setDeletingMessageId(msg._id);
    try {
      if (tab === 'public') {
        await chatAPI.deletePublicMessage(msg._id);
        setPublicMessages((prev) => prev.filter((m) => m._id !== msg._id));
      } else {
        await chatAPI.deletePrivateMessage(selectedConversation._id, msg._id);
        setPrivateMessages((prev) => prev.filter((m) => m._id !== msg._id));
      }
    } catch (err) {
      console.error('Failed to delete message:', err);
      alert('Failed to delete message');
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleEditMessage = (msg) => {
    setContextMenu(null);
    setEditingMessage({ msg, content: msg.content });
  };

  const handleSaveEdit = async () => {
    if (!editingMessage) return;
    const { msg, content } = editingMessage;
    const trimmed = content.trim();
    if (!trimmed || trimmed === msg.content) {
      setEditingMessage(null);
      return;
    }
    try {
      const msgId = typeof msg._id === 'string' ? msg._id : msg._id?.toString?.() || msg._id;
      const convId = selectedConversation?._id && (typeof selectedConversation._id === 'string' ? selectedConversation._id : selectedConversation._id?.toString?.());
      const updated = tab === 'public'
        ? await chatAPI.updatePublicMessage(msgId, trimmed)
        : await chatAPI.updatePrivateMessage(convId, msgId, trimmed);
      const updateMsg = (m) => (m._id === msg._id ? { ...m, ...updated } : m);
      if (tab === 'public') {
        setPublicMessages((prev) => prev.map(updateMsg));
      } else {
        setPrivateMessages((prev) => prev.map(updateMsg));
      }
    } catch (err) {
      console.error('Failed to edit message:', err);
      alert('Failed to edit message');
    } finally {
      setEditingMessage(null);
    }
  };

  const handleLongPressStart = (msg, e) => {
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    longPressTimerRef.current = setTimeout(() => {
      setContextMenu({ msg, x, y });
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMessageContextMenu = (msg, e) => {
    e.preventDefault();
    setContextMenu({ msg, x: e.clientX, y: e.clientY });
  };

  const handleReply = (msg, e) => {
    if (e) e.stopPropagation();
    setContextMenu(null);
    setReplyingTo({ msg });
    setEditingMessage(null);
  };

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
    }
  }, [contextMenu]);

  const handleStartChat = async (user) => {
    try {
      const conv = await chatAPI.createConversation(user._id);
      const list = conv.participants || [];
      const myId = currentUser?._id?.toString?.() || currentUser?.id;
      const other = list.find((p) => (p._id?.toString?.() || p._id) !== myId) || user;
      setConversations((prev) => {
        const exists = prev.some((c) => c._id === conv._id);
        if (exists) return prev;
        return [{ _id: conv._id, type: 'private', otherUser: other }, ...prev];
      });
      setSelectedConversation({ _id: conv._id, type: 'private', otherUser: other });
      setShowUserPicker(false);
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  const handleCreateGroup = async () => {
    if (selectedUserIds.length === 0) {
      alert('Select at least one person to add to the group');
      return;
    }
    setCreatingGroup(true);
    try {
      const conv = await chatAPI.createGroupChat(groupName.trim() || undefined, selectedUserIds);
      setConversations((prev) => {
        const exists = prev.some((c) => c._id === conv._id);
        if (exists) return prev;
        return [{
          _id: conv._id,
          type: 'group',
          name: conv.name || 'Group chat',
          participants: conv.participants,
          createdBy: conv.createdBy
        }, ...prev];
      });
      setSelectedConversation({
        _id: conv._id,
        type: 'group',
        name: conv.name || 'Group chat',
        participants: conv.participants
      });
      setShowGroupCreator(false);
      setGroupName('');
      setSelectedUserIds([]);
    } catch (err) {
      console.error('Failed to create group:', err);
      alert('Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const toggleUserForGroup = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const isGroupCreator = () => {
    if (tab !== 'group' || !selectedConversation) return false;
    const creatorId = selectedConversation.createdBy?._id || selectedConversation.createdBy;
    const myId = (currentUser?._id || currentUser?.id)?.toString?.();
    return (creatorId?.toString?.() || creatorId) === myId;
  };

  const handleKickMember = async (userId) => {
    if (!selectedConversation?._id || kickingUserId) return;
    if (!window.confirm('Remove this member from the group?')) return;
    setKickingUserId(userId);
    try {
      const updated = await chatAPI.kickFromGroup(selectedConversation._id, userId);
      setSelectedConversation((prev) => prev ? { ...prev, participants: updated.participants } : null);
      setConversations((prev) =>
        prev.map((c) => (c._id === selectedConversation._id ? { ...c, participants: updated.participants } : c))
      );
      setShowGroupMembers(false);
    } catch (err) {
      console.error('Failed to kick member:', err);
      alert(err.message || 'Failed to kick member');
    } finally {
      setKickingUserId(null);
    }
  };

  const handleAddMember = async (userId) => {
    if (!selectedConversation?._id || addingUserId) return;
    setAddingUserId(userId);
    try {
      const updated = await chatAPI.addToGroup(selectedConversation._id, userId);
      setSelectedConversation((prev) => prev ? { ...prev, participants: updated.participants } : null);
      setConversations((prev) =>
        prev.map((c) => (c._id === selectedConversation._id ? { ...c, participants: updated.participants } : c))
      );
      setShowAddMemberPicker(false);
    } catch (err) {
      console.error('Failed to add member:', err);
      alert(err.message || 'Failed to add member');
    } finally {
      setAddingUserId(null);
    }
  };

  const participantIds = (selectedConversation?.participants || []).map((p) => (p._id || p)?.toString?.() || p);
  const usersNotInGroup = users.filter((u) => !participantIds.includes((u._id || u)?.toString?.()));

  const privateConvs = conversations.filter((c) => (c.type || 'private') === 'private');
  const groupConvs = conversations.filter((c) => c.type === 'group');

  const messages = tab === 'public' ? publicMessages : privateMessages;
  const myId = (currentUser?._id || currentUser?.id)?.toString?.();
  const isOwnMessage = (msg) => {
    const sid = msg.senderId?._id || msg.senderId;
    return (sid?.toString?.() || sid) === myId;
  };

  return (
    <div className="community-chat">
      <div className="chat-top-chrome">
        <div className="chat-header">
          <h3><FiMessageCircle /> Chat with Brukis</h3>
          {onClose && (
            <button type="button" className="chat-close-btn" onClick={onClose} aria-label="Close">
              <FiX size={20} />
            </button>
          )}
        </div>

        <div className="chat-tabs" role="tablist" aria-label="Chat channels">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'public'}
            className={`chat-tab ${tab === 'public' ? 'active' : ''}`}
            onClick={() => { setTab('public'); setSelectedConversation(null); }}
          >
            <span className="chat-tab-inner">
              <span className="chat-tab-label">Public</span>
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'private'}
            className={`chat-tab ${tab === 'private' ? 'active' : ''}`}
            onClick={() => { setTab('private'); setSelectedConversation(null); }}
          >
            <span className="chat-tab-inner">
              <span className="chat-tab-label">Private</span>
              {privateConvs.some((c) => (c.unreadCount || 0) > 0) && (
                <span className="chat-tab-badge" aria-hidden>
                  {privateConvs.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
                </span>
              )}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'group'}
            className={`chat-tab ${tab === 'group' ? 'active' : ''}`}
            onClick={() => { setTab('group'); setSelectedConversation(null); }}
          >
            <span className="chat-tab-inner">
              <span className="chat-tab-label">
                <FiUsers size={14} aria-hidden /> Group
              </span>
              {groupConvs.some((c) => (c.unreadCount || 0) > 0) && (
                <span className="chat-tab-badge" aria-hidden>
                  {groupConvs.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
                </span>
              )}
            </span>
          </button>
        </div>
      </div>

      {tab === 'private' && !selectedConversation && !showUserPicker && (
        <div className="chat-conversation-list">
          <button
            type="button"
            className="chat-new-btn"
            onClick={() => setShowUserPicker(true)}
          >
            <FiUser size={16} /> Start new chat
          </button>
          {privateConvs.map((c) => (
            <div
              key={c._id}
              className={`chat-conv-item ${(c.unreadCount || 0) > 0 ? 'has-unread' : ''}`}
            >
              <button
                type="button"
                className="chat-conv-item-btn"
                onClick={() => setSelectedConversation(c)}
              >
                <div className="chat-conv-avatar">
                  {c.otherUser?.profilePhoto ? (
                    <img src={c.otherUser.profilePhoto} alt="" />
                  ) : (
                    <span>{(c.otherUser?.name || '?').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span className="chat-conv-name">{c.otherUser?.name || 'Unknown'}</span>
                {(c.unreadCount || 0) > 0 && (
                  <span className="chat-unread-badge">{c.unreadCount > 99 ? '99+' : c.unreadCount}</span>
                )}
              </button>
              <button
                type="button"
                className="chat-conv-delete-btn"
                onClick={(e) => handleDeleteConversation(c._id, e)}
                disabled={deleting}
                aria-label="Delete chat"
                title="Delete chat"
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          ))}
          {privateConvs.length === 0 && (
            <p className="chat-empty">No private chats yet. Start one!</p>
          )}
        </div>
      )}

      {tab === 'group' && !selectedConversation && !showGroupCreator && (
        <div className="chat-conversation-list">
          <button
            type="button"
            className="chat-new-btn"
            onClick={() => setShowGroupCreator(true)}
          >
            <FiUsers size={16} /> Create group chat
          </button>
          {groupConvs.map((c) => (
            <div
              key={c._id}
              className={`chat-conv-item ${(c.unreadCount || 0) > 0 ? 'has-unread' : ''}`}
            >
              <button
                type="button"
                className="chat-conv-item-btn"
                onClick={() => setSelectedConversation(c)}
              >
                <div className="chat-conv-avatar chat-conv-avatar-group">
                  <FiUsers size={20} />
                </div>
                <span className="chat-conv-name">{c.name || 'Group chat'}</span>
                {(c.unreadCount || 0) > 0 && (
                  <span className="chat-unread-badge">{c.unreadCount > 99 ? '99+' : c.unreadCount}</span>
                )}
              </button>
              <button
                type="button"
                className="chat-conv-delete-btn"
                onClick={(e) => handleDeleteConversation(c._id, e)}
                disabled={deleting}
                aria-label="Delete group"
                title="Delete group"
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          ))}
          {groupConvs.length === 0 && (
            <p className="chat-empty">No group chats yet. Create one!</p>
          )}
        </div>
      )}

      {tab === 'group' && showGroupCreator && (
        <div className="chat-user-picker">
          <button
            type="button"
            className="chat-back-btn"
            onClick={() => { setShowGroupCreator(false); setGroupName(''); setSelectedUserIds([]); }}
          >
            ← Back
          </button>
          <p className="chat-picker-label">Create group chat</p>
          <input
            type="text"
            className="chat-group-name-input"
            placeholder="Group name (optional)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <p className="chat-picker-label">Add members:</p>
          <div className="chat-user-list">
            {users.map((u) => (
              <button
                key={u._id}
                type="button"
                className={`chat-user-item ${selectedUserIds.includes(u._id) ? 'selected' : ''}`}
                onClick={() => toggleUserForGroup(u._id)}
              >
                <div className="chat-conv-avatar">
                  {u.profilePhoto ? (
                    <img src={u.profilePhoto} alt="" />
                  ) : (
                    <span>{(u.name || '?').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span>{u.name || 'Unknown'}</span>
                {selectedUserIds.includes(u._id) && <span className="chat-user-check">✓</span>}
              </button>
            ))}
          </div>
          <div className="chat-create-group-footer">
            <button
              type="button"
              className={`chat-create-group-btn ${selectedUserIds.length > 0 ? 'active' : ''}`}
              onClick={handleCreateGroup}
              disabled={creatingGroup || selectedUserIds.length === 0}
            >
              {creatingGroup ? 'Creating...' : selectedUserIds.length > 0 ? `Create group (${selectedUserIds.length} selected)` : 'Select members to create group'}
            </button>
          </div>
        </div>
      )}

      {tab === 'private' && showUserPicker && (
        <div className="chat-user-picker">
          <button
            type="button"
            className="chat-back-btn"
            onClick={() => setShowUserPicker(false)}
          >
            ← Back
          </button>
          <p className="chat-picker-label">Select a user to chat with:</p>
          <div className="chat-user-list">
            {users.map((u) => (
              <button
                key={u._id}
                type="button"
                className="chat-user-item"
                onClick={() => handleStartChat(u)}
              >
                <div className="chat-conv-avatar">
                  {u.profilePhoto ? (
                    <img src={u.profilePhoto} alt="" />
                  ) : (
                    <span>{(u.name || '?').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <span>{u.name || 'Unknown'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {(tab === 'public' || ((tab === 'private' || tab === 'group') && selectedConversation)) && (
        <>
          {(tab === 'private' || tab === 'group') && selectedConversation && (
            <div className="chat-conv-header">
              <button
                type="button"
                className="chat-back-btn"
                onClick={() => { setSelectedConversation(null); setShowGroupMembers(false); setShowAddMemberPicker(false); }}
              >
                ← Back
              </button>
              <span className="chat-conv-name">
                {tab === 'group' ? (selectedConversation.name || 'Group chat') : (selectedConversation.otherUser?.name || 'Chat')}
              </span>
              <div className="chat-conv-header-actions">
                {tab === 'group' && isGroupCreator() && (
                  <button
                    type="button"
                    className="chat-members-btn"
                    onClick={() => setShowGroupMembers((p) => !p)}
                    aria-label="Group members"
                    title="Group members"
                  >
                    <FiUsers size={18} /> Members
                  </button>
                )}
                <button
                  type="button"
                  className="chat-delete-btn"
                  onClick={() => handleDeleteConversation(selectedConversation._id)}
                  disabled={deleting}
                  aria-label="Delete chat"
                  title="Delete chat"
                >
                  <FiTrash2 size={18} /> Delete
                </button>
              </div>
            </div>
          )}

          {tab === 'group' && selectedConversation && showGroupMembers && (
            <div className="chat-group-members-panel">
              <div className="chat-members-panel-header">
                <h4 className="chat-members-title">{showAddMemberPicker ? 'Add member' : 'Group members'}</h4>
                {isGroupCreator() && (
                  <button
                    type="button"
                    className="chat-add-member-btn"
                    onClick={() => setShowAddMemberPicker((p) => !p)}
                  >
                    {showAddMemberPicker ? (
                      <>← Back</>
                    ) : (
                      <><FiUserPlus size={16} /> Add</>
                    )}
                  </button>
                )}
              </div>
              {showAddMemberPicker ? (
                <div className="chat-members-list">
                  {usersNotInGroup.length === 0 ? (
                    <p className="chat-members-empty">No users to add. Everyone is already in the group.</p>
                  ) : (
                    usersNotInGroup.map((u) => (
                      <div key={u._id} className="chat-member-row">
                        <div className="chat-conv-avatar">
                          {u.profilePhoto ? (
                            <img src={u.profilePhoto} alt="" />
                          ) : (
                            <span>{(u.name || '?').charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <span className="chat-member-name">{u.name || 'Unknown'}</span>
                        <button
                          type="button"
                          className="chat-add-btn"
                          onClick={() => handleAddMember(u._id)}
                          disabled={addingUserId === u._id}
                          aria-label="Add to group"
                          title="Add to group"
                        >
                          <FiUserPlus size={16} /> Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
              <div className="chat-members-list">
                {(selectedConversation.participants || []).map((p) => {
                  const pid = p._id || p;
                  const pIdStr = pid?.toString?.() || pid;
                  const isMe = pIdStr === (currentUser?._id || currentUser?.id)?.toString?.();
                  const name = p.name || (typeof p === 'object' ? 'Unknown' : 'Unknown');
                  return (
                    <div key={pIdStr} className="chat-member-row">
                      <div className="chat-conv-avatar">
                        {p.profilePhoto ? (
                          <img src={p.profilePhoto} alt="" />
                        ) : (
                          <span>{(name || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span className="chat-member-name">{name}{isMe && ' (you)'}</span>
                      {isGroupCreator() && !isMe && (
                        <button
                          type="button"
                          className="chat-kick-btn"
                          onClick={() => handleKickMember(pIdStr)}
                          disabled={kickingUserId === pIdStr}
                          aria-label="Kick"
                          title="Remove from group"
                        >
                          <FiUserMinus size={16} /> Kick
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          )}

          <div className="chat-messages" ref={scrollRef}>
            {loading ? (
              <p className="chat-loading">Loading...</p>
            ) : messages.length === 0 ? (
              <p className="chat-empty">No messages yet. Say hi!</p>
            ) : (
              messages.map((msg, idx) => {
                const prevDate = messages[idx - 1]?.createdAt;
                const currDate = msg.createdAt;
                const showDateSep = !prevDate || new Date(prevDate).toDateString() !== new Date(currDate).toDateString();
                return (
                  <React.Fragment key={msg._id}>
                    {showDateSep && (
                      <div className="chat-date-separator">
                        <span>{formatDateLabel(currDate)}</span>
                      </div>
                    )}
                    <div
                      className={`chat-msg ${isOwnMessage(msg) ? 'own' : 'other'}`}
                      data-msg-id={msg._id}
                      onMouseDown={(e) => handleLongPressStart(msg, e)}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      onTouchStart={(e) => handleLongPressStart(msg, e.touches[0])}
                      onTouchEnd={handleLongPressEnd}
                      onContextMenu={(e) => handleMessageContextMenu(msg, e)}
                    >
                      {(tab === 'public' || tab === 'group') && !isOwnMessage(msg) && (
                        <div className="chat-msg-avatar">
                          {msg.senderId?.profilePhoto ? (
                            <img src={msg.senderId.profilePhoto} alt="" />
                          ) : (
                            <span>{(msg.senderId?.name || '?').charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                      )}
                      <div className="chat-msg-bubble-wrap">
                        <button
                          type="button"
                          className="chat-msg-reply-btn"
                          onClick={(e) => handleReply(msg, e)}
                          aria-label="Reply"
                          title="Reply"
                        >
                          <FiCornerDownRight size={14} />
                        </button>
                        <div className="chat-msg-bubble">
                          {(tab === 'public' || tab === 'group') && !isOwnMessage(msg) && (
                            <span className="chat-msg-sender">{msg.senderId?.name || 'Unknown'}</span>
                          )}
                          {editingMessage?.msg._id === msg._id ? (
                            <div className="chat-msg-edit">
                              <input
                                type="text"
                                value={editingMessage.content}
                                onChange={(e) => setEditingMessage((p) => ({ ...p, content: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingMessage(null); }}
                                autoFocus
                              />
                              <button type="button" onClick={handleSaveEdit}>Save</button>
                              <button type="button" onClick={() => setEditingMessage(null)}>Cancel</button>
                            </div>
                          ) : (
                            <>
                              {msg.replyTo && (
                                <div className="chat-msg-reply-preview">
                                  <FiCornerDownRight size={12} />
                                  <span className="chat-msg-reply-author">
                                    {msg.replyTo?.senderId?.name || 'Unknown'}
                                  </span>
                                  <span className="chat-msg-reply-content">
                                    {msg.replyTo?.content?.slice(0, 80)}
                                    {msg.replyTo?.content?.length > 80 ? '…' : ''}
                                  </span>
                                </div>
                              )}
                              <p className="chat-msg-content">{msg.content}</p>
                              <span className="chat-msg-time">{formatTime(msg.createdAt)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} className="chat-messages-end-spacer" aria-hidden />
          </div>

          {contextMenu && (
            <div
              className="chat-msg-context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" onClick={() => handleReply(contextMenu.msg)}>
                <FiCornerDownRight size={14} /> Reply
              </button>
              {isOwnMessage(contextMenu.msg) && (
                <>
                  <button type="button" onClick={() => handleEditMessage(contextMenu.msg)}>
                    <FiEdit2 size={14} /> Edit
                  </button>
                  <button type="button" onClick={() => handleDeleteMessage(contextMenu.msg)}>
                    <FiTrash2 size={14} /> Delete
                  </button>
                </>
              )}
            </div>
          )}

          <div className="chat-composer-spacer" aria-hidden />
          <div ref={composerStackRef} className="chat-input-stack chat-input-stack--mobile-fixed">
            {replyingTo && (
              <div className="chat-reply-preview">
                <FiCornerDownRight size={14} />
                <span className="chat-reply-preview-author">
                  {replyingTo.msg?.senderId?.name || 'Unknown'}
                </span>
                <span className="chat-reply-preview-content">
                  {replyingTo.msg?.content?.slice(0, 60)}
                  {replyingTo.msg?.content?.length > 60 ? '…' : ''}
                </span>
                <button
                  type="button"
                  className="chat-reply-preview-cancel"
                  onClick={() => setReplyingTo(null)}
                  aria-label="Cancel reply"
                >
                  <FiX size={14} />
                </button>
              </div>
            )}
            <form
              className="chat-input-form"
              onSubmit={tab === 'public' ? handleSendPublic : handleSendPrivate}
            >
              <input
                type="text"
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="on"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={tab === 'public' ? 'Message the community…' : 'Type a message…'}
                maxLength={2000}
                disabled={sending}
              />
              <button type="submit" disabled={sending || !inputValue.trim()} aria-label="Send">
                <FiSend size={18} />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default CommunityChat;
