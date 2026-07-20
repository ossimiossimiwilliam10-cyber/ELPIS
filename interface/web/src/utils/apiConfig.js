export const getApiUrl = () => {
  const customIp = localStorage.getItem('serverIp');
  if (customIp && customIp.trim() !== '') {
    return `http://${customIp.trim()}:3001/api`;
  }
  return '/api';
};

export const getServerUrl = () => {
  const customIp = localStorage.getItem('serverIp');
  if (customIp && customIp.trim() !== '') {
    return `http://${customIp.trim()}:3001`;
  }
  return '';
};

export const setApiUrl = (ip) => {
  localStorage.setItem('serverIp', ip);
};

export const getRawIp = () => {
  return localStorage.getItem('serverIp') || '';
};
