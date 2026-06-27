import { useState, useCallback } from 'react';
import { sendLog } from './logger';

// Єдина логіка надсилання логу для всіх місць (журнал помилок, екран збою тощо):
// машина станів idle → sending → результат (server|share|clipboard|fail). Так поведінка
// й статуси однакові звідусіль — sendLog (API → файл+«Поділитися» → текст → буфер) в
// одному місці, а компоненти лише показують стан.
export const useLogSend = (note) => {
    const [state, setState] = useState('idle');
    const send = useCallback(async () => {
        setState('sending');
        setState((await sendLog(note)) || 'fail');
    }, [note]);
    return { state, send, sending: state === 'sending' };
};
