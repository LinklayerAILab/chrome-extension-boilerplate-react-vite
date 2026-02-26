import { Select, InputPassword, Button, message } from '@src/ui';
import { useState } from 'react';
import { platformListData } from '../lib/enum';
import { useI18n } from '@src/lib/i18n';
import { add_userapikey } from '@src/api/agent_c';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@src/store';
import { setPageInfo } from '@src/store/slices/pageInfoSlice';
import { usePageInfoUpdate } from '@src/lib/hooks/usePageInfoUpdate';

export const AddApi = () => {
  const { t, locale } = useI18n();

  // 监听语言切换事件，更新页面标题和描述
  usePageInfoUpdate('api', locale);

  const rightGary = chrome.runtime.getURL('content-ui/platform/rightGary.svg');
  const go = chrome.runtime.getURL('content-ui/platform/go.svg');
  const [selectedTabId, setSelectedTabId] = useState(1);
  const [list] = useState(
    platformListData.map(item => {
      return {
        ...item,
        disabled: item.name === 'Binance' ? false : true,
      };
    }),
  );
  const tabs = [
    { id: 1, title: t.apiForm?.uploadApi || 'Upload API' },
    { id: 2, title: t.apiForm?.apiGuide || 'API Guide' },
  ];

  const [selectedExchange, setSelectedExchange] = useState(platformListData[0].name);
  const [formData, setFormData] = useState({
    apiKey: '',
    secretKey: '',
    passphrase: '',
  });
  const [errors, setErrors] = useState({
    apiKey: '',
    secretKey: '',
    passphrase: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (value: string) => {
    console.log('Selected value:', value);
    setSelectedExchange(value as (typeof platformListData)[number]['name']);
    // Clear passphrase when switching to exchange that doesn't need it
    if (value !== 'OKX' && value !== 'Bitget') {
      setFormData(prev => ({ ...prev, passphrase: '' }));
      setErrors(prev => ({ ...prev, passphrase: '' }));
    }
  };

  const handleInputChange = (field: 'apiKey' | 'secretKey' | 'passphrase', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (value.trim()) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {
      apiKey: '',
      secretKey: '',
      passphrase: '',
    };

    if (!formData.apiKey.trim()) {
      newErrors.apiKey = t.apiForm?.apiKeyRequired || 'API Key is required';
    }
    if (!formData.secretKey.trim()) {
      newErrors.secretKey = t.apiForm?.secretKeyRequired || 'Secret Key is required';
    }
    if (needsPassphrase && !formData.passphrase.trim()) {
      newErrors.passphrase = t.apiForm?.passphraseRequired || 'Passphrase is required';
    }

    setErrors(newErrors);
    return !newErrors.apiKey && !newErrors.secretKey && !newErrors.passphrase;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    // 校验必填字段
    if (!selectedExchange) {
      message.error(t.apiForm?.cexNameRequired || 'CEX Name is required');
      return;
    }

    if (!formData.apiKey.trim()) {
      message.error(t.apiForm?.apiKeyRequired || 'API Key is required');
      return;
    }

    if (!formData.secretKey.trim()) {
      message.error(t.apiForm?.secretKeyRequired || 'Secret Key is required');
      return;
    }

    if (needsPassphrase && !formData.passphrase.trim()) {
      message.error(t.apiForm?.passphraseRequired || 'Passphrase is required');
      return;
    }

    try {
      setLoading(true);
      await add_userapikey({
        apikey: formData.apiKey,
        secretkey: formData.secretKey,
        passphrase: needsPassphrase ? formData.passphrase : undefined,
        cex_name: selectedExchange.toLowerCase(),
      });

      message.success(t.apiForm?.submitSuccess || 'API Keys submitted successfully');
      // Reset form after successful submission
      setFormData({
        apiKey: '',
        secretKey: '',
        passphrase: '',
      });
    } catch (error) {
      // Error is already handled by the service interceptor
      console.error('Failed to submit API keys:', error);
    } finally {
      setLoading(false);
    }
  };
  const dispatch = useDispatch<AppDispatch>();
  const needsPassphrase = selectedExchange === 'OKX' || selectedExchange === 'Bitget';
  const handleTo = (item: (typeof platformListData)[0]) => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const docLink = isMobile ? (item.doc_mobile ? item.doc_mobile : item.doc_pc) : item.doc_pc;
    if (docLink) {
      window.open(docLink, '_blank');
    }
  };

  const handleClick = (tabId: number) => {
    setSelectedTabId(tabId);
    if (tabId === 1) {
      dispatch(
        setPageInfo({
          page: 'api',
          info: {
            title: t.apiForm?.pageTitleUpload || 'Upload API',
            description: t.apiForm?.pageDescUpload || 'Connect Read-Only API to unlock position analysis',
          },
        }),
      );
    } else {
      dispatch(
        setPageInfo({
          page: 'api',
          info: {
            title: t.apiForm?.pageTitleGuide || 'API Guide',
            description: t.apiForm?.pageDescGuide || 'Step-by-step guide to securely connect your Read-Only API',
          },
        }),
      );
    }
  };

  // dispatch(setPageTitle({ page: 'earn', title: 'New Title' }));
  return (
    <div className="mb-[20px] mt-2 flex flex-col gap-4 text-[12px]">
      <div className="flex gap-[10px]">
        {tabs.map(btn => (
          <button
            key={btn.id}
            style={{ fontSize: 12 }}
            className={`rounded-full px-4 py-2 font-bold ${selectedTabId === btn.id ? 'bg-[#cf0] text-black' : 'bg-[#F4FFC8] text-gray-400'}`}
            onClick={() => handleClick(btn.id)}>
            {btn.title}
          </button>
        ))}
      </div>
      {selectedTabId === 1 && (
        <div className="flex flex-col gap-4 text-black">
          <div>
            <div className="mb-2">
              <span className="mr-1 text-red-500">*</span>
              {t.apiForm?.exchangeLabel || 'Exchange'}
            </div>
            <Select value={selectedExchange} onChange={handleChange} size="large">
              {platformListData.map(platform => (
                <Select.Option
                  key={platform.name}
                  value={platform.name}
                  label={platform.name}
                  disabled={platform.disabled}>
                  <div className="flex items-center gap-2">
                    <img
                      src={platform.imgA}
                      alt={platform.name}
                      className={`h-[20px] w-[20px] object-contain ${platform.disabled ? 'grayscale' : ''}`}
                    />
                    <span>{platform.name}</span>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-2 block">
                <span className="mr-1 text-red-500">*</span>
                {t.apiForm?.apiKeyLabel || 'API Key'}
              </label>
              <InputPassword
                placeholder={t.apiForm?.apiKeyPlaceholder || 'Enter API Key'}
                size="large"
                value={formData.apiKey}
                onChange={e => handleInputChange('apiKey', e.target.value)}
              />
              {errors.apiKey && <p className="mt-1 text-xs text-red-500">{errors.apiKey}</p>}
            </div>

            <div>
              <label className="mb-2 block">
                <span className="mr-1 text-red-500">*</span>
                {t.apiForm?.secretKeyLabel || 'Secret Key'}
              </label>
              <InputPassword
                placeholder={t.apiForm?.secretKeyPlaceholder || 'Enter Secret Key'}
                size="large"
                value={formData.secretKey}
                onChange={e => handleInputChange('secretKey', e.target.value)}
              />
              {errors.secretKey && <p className="mt-1 text-xs text-red-500">{errors.secretKey}</p>}
            </div>

            {needsPassphrase && (
              <div>
                <label className="mb-2 block">
                  <span className="mr-1 text-red-500">*</span>
                  {t.apiForm?.passphraseLabel || 'Passphrase'}
                </label>
                <InputPassword
                  placeholder={t.apiForm?.passphrasePlaceholder || 'Enter Passphrase'}
                  size="large"
                  value={formData.passphrase}
                  onChange={e => handleInputChange('passphrase', e.target.value)}
                />
                {errors.passphrase && <p className="mt-1 text-xs text-red-500">{errors.passphrase}</p>}
              </div>
            )}
          </div>

          <div className="mt-4">
            <Button
              type="primary"
              size="large"
              block
              loading={loading}
              onClick={handleSubmit}
              style={{ fontWeight: 'bold' }}>
              {t.apiForm?.submit || 'Submit'}
            </Button>
          </div>
        </div>
      )}
      {selectedTabId === 2 && (
        <div className="text-black">
          <div className="text-[20px] font-bold">{t.apiForm?.readOnlyApiTitle || 'What is Read-Only API?'}</div>
          <div className="mt-2 text-[12px]">
            {t.apiForm?.readOnlyApiDescription ||
              'A read-only API key only allows viewing balances, positions, and trade history, with absolutely no ability to trade, withdraw, or change your account, making it safe to share?and you can disable it anytime. Learn through the following tutorial docs.'}
          </div>
          <div
            className="custom-scrollbar mt-8 h-[58vh] overflow-y-auto"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#ccc #f1f5f9', // Firefox: thumb color, track color (slate-300, slate-100)
            }}>
            {list.map((item, index) => (
              <div
                key={index}
                className="mt-[10px] flex h-[5.8vh] cursor-pointer items-center justify-between rounded-[8px] bg-[#F1F1F1] p-[10px]">
                <div className="flex items-center gap-3">
                  <img src={item.imgA} alt={item.name} className="h-[28px] w-[28px] object-contain" />
                  <div className="text-[11px] font-bold">
                    {item.name} {t.apiForm?.readOnlyApiDocs || 'Read-Only API Docs'}
                  </div>
                </div>
                <div className="cursor-pointer text-[14px] text-[#007AFF]">
                  {!item.doc_pc ? (
                    <img
                      src={rightGary}
                      alt="Right"
                      className="mr-[4px] inline-block h-[18px] w-[18px] cursor-not-allowed"
                    />
                  ) : (
                    <img
                      src={go}
                      alt="Right"
                      className="mr-[4px] inline-block h-[2vh] w-[2vh]"
                      onClick={() => handleTo(item)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
