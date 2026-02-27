import { useI18n } from '@src/lib/i18n';
import { useSelector } from 'react-redux';
import { RootState } from '@src/store';
import { API_BASE_URL } from '@src/api/config';
import { useState } from 'react';
import { Button } from '@src/ui';
import { message } from '@src/ui';

const icon = chrome.runtime.getURL('content-ui/invitePanel/icon.svg');
const banner = chrome.runtime.getURL('content-ui/invitePanel/banner.svg');
const gift = chrome.runtime.getURL('content-ui/invitePanel/gift.svg');
const share = chrome.runtime.getURL('content-ui/invitePanel/share.svg');
const money = chrome.runtime.getURL('content-ui/invitePanel/money.svg');

export const InvitePanel = () => {
  const { t } = useI18n();
  const otherInfo = useSelector((state: RootState) => state.user.otherInfo);
  const address = useSelector((state: RootState) => state.user.address);

  // 生成邀请链接
  const generateInviteLink = () => {
    if (!otherInfo.invite_code) return '';

    const baseUrl = API_BASE_URL.replace(/\/$/, ''); // 移除末尾的斜杠
    const targetUrl = `${baseUrl}?invite_code=${otherInfo.invite_code}`;
    const backUrl = baseUrl;

    // URL encode the targetUrl
    const encodedTargetUrl = encodeURIComponent(targetUrl);

    return `${baseUrl}/toDapp?toUrl=${encodedTargetUrl}&backUrl=${backUrl}`;
  };

  const inviteLink = generateInviteLink();

  const handleCopyLink = () => {
    console.log('[InvitePanel] handleCopyLink');
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      message.success(t.invite?.copySuccess || t.common?.copySuccess || 'Link copied to clipboard!');
    } else {
      message.error(t.invite?.noInviteCode || 'No invite code available');
    }
  };

  const handlePostOn = () => {
    // 打开 Twitter/X 分享页面
    const shareText = t.invite?.shareText || 'Check out LinkLayer AI Agent!';
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(inviteLink)}`;
    window.open(twitterUrl, '_blank');
  };

  return (
    <div className="flex w-[320px] flex-col gap-[12px] rounded-lg bg-white p-[10px]">
      <div className="relative h-[140px] w-full">
        <img src={banner} className="h-full object-contain" alt=""></img>
        <img src={icon} className="absolute left-[-24px] top-[-24px] w-[80px]" alt=""></img>
      </div>
      <div className="flex items-center gap-2 font-bold">
        <img src={share} alt="" />
        {t.invite?.shareTitle || 'Share Your Invite Code'}
      </div>
      <div className="flex items-center gap-2 font-bold">
        <img src={gift} alt="" />
        {t.invite?.shareDesc1 || 'Earn Points as an Early Adopter'}
      </div>
      <div className="flex items-center gap-2 font-bold">
        <img src={money} alt="" />
        {t.invite?.shareDesc2 || 'Double the points: You earn, they earn.'}
      </div>
      <div className="flex justify-between gap-4">
        <Button onClick={handleCopyLink} size="small" block style={{ background: '#cf0', fontWeight: 'bold' }}>
          {t.invite?.copyLink || 'Copy Link'}
        </Button>
        <Button onClick={handlePostOn} size="small" block style={{ background: '#cf0', fontWeight: 'bold' }}>
          {t.invite?.postOn || 'Post on'}
        </Button>
      </div>
    </div>
  );
};
