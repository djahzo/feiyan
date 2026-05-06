import React from 'react';
import { BilibiliDynamicItem } from '../types/bilibili';

interface DynamicCardProps {
  dynamic: BilibiliDynamicItem;
}

const DynamicCard: React.FC<DynamicCardProps> = ({ dynamic }) => {
  const author = dynamic.modules.module_author;
  const content = dynamic.modules.module_dynamic;
  const text = content?.desc?.text || '';
  const archive = content?.major?.archive;
  const images = content?.major?.draw?.items || [];

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-4 hover:shadow-xl transition-shadow">
      {author && (
        <div className="flex items-center mb-4">
          <img
            src={author.face}
            alt={author.name}
            className="w-12 h-12 rounded-full mr-3"
          />
          <div>
            <h4 className="font-semibold text-gray-800">{author.name}</h4>
            <p className="text-sm text-gray-500">{author.pub_time}</p>
          </div>
        </div>
      )}

      {text && (
        <p className="text-gray-700 mb-4 whitespace-pre-wrap">{text}</p>
      )}

      {archive && (
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
          <img
            src={archive.cover}
            alt={archive.title}
            className="w-full h-48 object-cover"
          />
          <div className="p-4">
            <h5 className="font-semibold text-gray-800 mb-2">{archive.title}</h5>
            <p className="text-sm text-gray-600">{archive.desc}</p>
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.slice(0, 9).map((img, index) => (
            <img
              key={index}
              src={img.src}
              alt={`图片${index + 1}`}
              className="w-full h-32 object-cover rounded-lg"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DynamicCard;
