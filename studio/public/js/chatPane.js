// studio/public/js/chatPane.js
//
// The right chat + save pane. Owns an in-memory, per-page message history
// (chat isn't persisted across reloads \u2014 only the pages-collapsed
// preference is), the edit request lifecycle, and the save-as-new flow.

import { postEdit, postSave } from './api.js';
import { baseNameOf, describeEditError, describeSaveError, folderKey, nextVariantName } from './format.js';

function buildMessageRow(message) {
  const row = document.createElement('div');
  row.className = `chat-message chat-message-${message.role}`;
  row.textContent = message.text;
  return row;
}

/**
 * @param {object} elements
 * @param {{ getGroupedPages: () => object, onEditSuccess: () => void, onSaved: (newPath: string) => void }} callbacks
 */
export function createChatPane(elements, { getGroupedPages, onEditSuccess, onSaved }) {
  const { history, form, input, sendBtn, saveAsBtn, workingIndicator, savePanel, saveNameInput, saveConfirmBtn, saveCancelBtn, saveError } = elements;

  const historiesByPage = new Map();
  let currentPage = null;

  function historyFor(relPath) {
    if (!historiesByPage.has(relPath)) historiesByPage.set(relPath, []);
    return historiesByPage.get(relPath);
  }

  function renderHistory() {
    if (!currentPage) {
      history.replaceChildren();
      return;
    }
    const messages = historyFor(currentPage);
    if (messages.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'chat-empty';
      empty.textContent = 'Describe an edit below to get started on this page.';
      history.replaceChildren(empty);
      return;
    }
    history.replaceChildren(...messages.map(buildMessageRow));
    history.scrollTop = history.scrollHeight;
  }

  function setPage(relPath) {
    currentPage = relPath;
    closeSavePanel();
    renderHistory();
    input.disabled = !relPath;
    sendBtn.disabled = !relPath;
    saveAsBtn.disabled = !relPath;
  }

  function setWorking(working) {
    input.disabled = working;
    sendBtn.disabled = working;
    workingIndicator.hidden = !working;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const instruction = input.value.trim();
    if (!instruction || !currentPage) return;

    const messages = historyFor(currentPage);
    const priorHistory = messages.map(({ role, text }) => ({ role, text }));
    messages.push({ role: 'user', text: instruction });
    input.value = '';
    renderHistory();
    setWorking(true);

    try {
      const { summary } = await postEdit({ path: currentPage, instruction, history: priorHistory });
      messages.push({ role: 'assistant', text: summary });
      onEditSuccess();
    } catch (err) {
      messages.push({ role: 'error', text: describeEditError(err) });
    } finally {
      renderHistory();
      setWorking(false);
    }
  }

  function suggestedSaveName() {
    const grouped = getGroupedPages();
    const siblings = (grouped[folderKey(currentPage)] || []).map(baseNameOf);
    return nextVariantName(baseNameOf(currentPage), siblings);
  }

  function openSavePanel() {
    if (!currentPage) return;
    saveError.hidden = true;
    saveNameInput.value = suggestedSaveName();
    savePanel.hidden = false;
    saveNameInput.focus();
    saveNameInput.select();
  }

  function closeSavePanel() {
    savePanel.hidden = true;
    saveError.hidden = true;
  }

  function showSaveError(message) {
    saveError.textContent = message;
    saveError.hidden = false;
  }

  async function confirmSave() {
    const newName = saveNameInput.value.trim();
    if (!newName) {
      showSaveError('Enter a file name.');
      return;
    }
    saveConfirmBtn.disabled = true;
    try {
      const { path: newPath } = await postSave({ path: currentPage, newName });
      closeSavePanel();
      onSaved(newPath);
    } catch (err) {
      showSaveError(describeSaveError(err));
    } finally {
      saveConfirmBtn.disabled = false;
    }
  }

  form.addEventListener('submit', handleSubmit);
  saveAsBtn.addEventListener('click', openSavePanel);
  saveCancelBtn.addEventListener('click', closeSavePanel);
  saveConfirmBtn.addEventListener('click', confirmSave);
  saveNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSavePanel();
  });

  setPage(null);

  return { setPage };
}
