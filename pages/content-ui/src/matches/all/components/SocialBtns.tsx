import { Popover } from '@src/ui';
import { SettingPanel } from './SettingPanel';
import { InvitePanel } from './InvitePanel';

interface SocialBtnsProps {
  onMenuSelect?: (menuId: number) => void;
}

export const SocialBtns = ({ onMenuSelect }: SocialBtnsProps) => {
  const socialButtons = [
    {
      icon: 'money.svg',
      value: 1,
    },
    // {
    //   icon: 'invite.svg',
    //   value: 2,
    // },
    {
      icon: 'x.svg',
      link: 'https://x.com/LinkLayerAI',
      value: 3,
    },
    {
      icon: 'telegram.svg',
      link: 'https://t.me/linklayer_ai',
      value: 4,
    },
    {
      icon: 'setting.svg',
      value: 5,
    },
  ];
  return (
    <div className="flex w-full flex-col items-center justify-center gap-[0.6vh]">
      {socialButtons.map(btn => {
        const iconUrl = chrome.runtime.getURL(`content-ui/${btn.icon}`);
        return (
          <div key={btn.value} className="py-[1vh]">
            {btn.link ? (
              <a href={btn.link} target="_blank" rel="noreferrer">
                <img src={iconUrl} alt={btn.icon} className="h-[3.5vh] w-[3.5vh]" />
              </a>
            ) : btn.value === 5 ? (
              <Popover content={<SettingPanel />} placement="topLeft" trigger="click">
                <img src={iconUrl} alt={btn.icon} className="h-[3.5vh] w-[3.5vh]" />
              </Popover>
            ) : btn.value === 1 ? (
              <button
                onClick={() => onMenuSelect && onMenuSelect(6)}
                className="cursor-pointer border-none bg-transparent p-0">
                <img src={iconUrl} alt={btn.icon} className="h-[3.5vh] w-[3.5vh]" />
              </button>
            ) : (
              <img src={iconUrl} alt={btn.icon} className="h-[3.5vh] w-[3.5vh]" />
            )}
          </div>
        );
      })}
    </div>
  );
};
