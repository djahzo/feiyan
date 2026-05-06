import React, { useState } from 'react';
import { BilibiliUserInfo } from '../types/bilibili';

interface UserCardProps {
  userInfo: BilibiliUserInfo;
}

const UserCard: React.FC<UserCardProps> = ({ userInfo }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-8">
      {/* 顶部装饰条 */}
      <div className="h-2 bg-gradient-to-r from-primary-500 via-accent-500 to-primary-600"></div>

      <div className="p-8 md:p-12">
        <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
          {/* 头像 */}
          <div className="relative group">
            {!imageError ? (
              <img
                src={userInfo.face}
                alt={userInfo.name}
                className="w-32 h-32 md:w-40 md:h-40 rounded-2xl object-cover shadow-lg ring-4 ring-primary-100 group-hover:ring-primary-300 transition-all duration-300"
                onError={() => setImageError(true)}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg ring-4 ring-primary-100">
                <span className="text-white text-5xl font-bold">
                  {userInfo.name.charAt(0)}
                </span>
              </div>
            )}
            {/* 等级徽章 */}
            <div className="absolute -bottom-3 -right-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg">
              LV{userInfo.level}
            </div>
          </div>

          {/* 用户信息 */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              {userInfo.name}
            </h1>
            <p className="text-gray-600 text-lg mb-6 whitespace-pre-line leading-relaxed">
              {userInfo.sign || '这个人很懒，什么都没有留下~'}
            </p>

            {/* 标签栏 */}
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              <div className="flex items-center space-x-2 bg-gray-50 px-4 py-2 rounded-xl">
                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-gray-700 font-medium">UID: {userInfo.mid}</span>
              </div>

              {userInfo.sex && (
                <div className="flex items-center space-x-2 bg-gray-50 px-4 py-2 rounded-xl">
                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-700 font-medium">{userInfo.sex}</span>
                </div>
              )}

              {userInfo.birthday && (
                <div className="flex items-center space-x-2 bg-gray-50 px-4 py-2 rounded-xl">
                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-gray-700 font-medium">{userInfo.birthday}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserCard;
