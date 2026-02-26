import inlineCss from '../../../dist/all/index.css?inline';
import { initAppWithShadow } from '@extension/shared';
import App from '@src/matches/all/App';
import { Provider } from 'react-redux';
import { store } from '@src/store';

// 初始化 Shadow DOM 应用
initAppWithShadow({
  id: 'CEB-extension-all',
  app: (
    <Provider store={store}>
      <App />
    </Provider>
  ),
  inlineCss,
});
