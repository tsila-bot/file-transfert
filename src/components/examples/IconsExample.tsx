import React from 'react';
import {
  FaHome,
  FaUser,
  FaCog,
  FaSignOutAlt,
  FaDownload,
  FaUpload,
  FaCheck,
  FaExclamationTriangle,
  FaSpinner,
  FaTimes,
  FaSearch,
  FaBell,
  FaFileAlt,
  FaFolder,
  FaComment,
  FaComments,
  FaEnvelope,
} from 'react-icons/fa';
import { AiOutlineFile, AiOutlineCloudDownload, AiOutlineCloudUpload } from 'react-icons/ai';
import { BiTransfer, BiErrorCircle } from 'react-icons/bi';
import { MdDashboard, MdNotifications } from 'react-icons/md';

export function IconsExample() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Icons Examples with React Icons</h1>

      {/* Font Awesome Icons */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Font Awesome Icons (FaIcons)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <FaHome size={32} className="text-blue-500 mb-2" />
            <span className="text-sm">Home</span>
          </div>
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <FaUser size={32} className="text-green-500 mb-2" />
            <span className="text-sm">User</span>
          </div>
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <FaCog size={32} className="text-purple-500 mb-2" />
            <span className="text-sm">Settings</span>
          </div>
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <FaDownload size={32} className="text-orange-500 mb-2" />
            <span className="text-sm">Download</span>
          </div>
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <FaUpload size={32} className="text-red-500 mb-2" />
            <span className="text-sm">Upload</span>
          </div>
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <FaCheck size={32} className="text-emerald-500 mb-2" />
            <span className="text-sm">Check</span>
          </div>
        </div>
      </section>

      {/* Status Icons */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Status Icons</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-4 border rounded-lg">
            <FaCheck size={24} className="text-green-500" />
            <span>Success</span>
          </div>
          <div className="flex items-center gap-3 p-4 border rounded-lg">
            <FaExclamationTriangle size={24} className="text-yellow-500" />
            <span>Warning</span>
          </div>
          <div className="flex items-center gap-3 p-4 border rounded-lg">
            <BiErrorCircle size={24} className="text-red-500" />
            <span>Error</span>
          </div>
          <div className="flex items-center gap-3 p-4 border rounded-lg animate-spin">
            <FaSpinner size={24} className="text-blue-500" />
            <span>Loading</span>
          </div>
        </div>
      </section>

      {/* Message/Chat Icons */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Message & Chat Icons</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <FaComment size={32} className="text-blue-500 mb-2" />
            <span className="text-sm">Comment</span>
          </div>
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <FaComments size={32} className="text-cyan-500 mb-2" />
            <span className="text-sm">Comments</span>
          </div>
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <FaEnvelope size={32} className="text-green-500 mb-2" />
            <span className="text-sm">Message</span>
          </div>
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <FaBell size={32} className="text-yellow-500 mb-2" />
            <span className="text-sm">Notification</span>
          </div>
        </div>
      </section>

      {/* Transfer Icons */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Transfer Icons</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <BiTransfer size={32} className="text-indigo-500 mb-2" />
            <span className="text-sm">Transfer</span>
          </div>
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <AiOutlineCloudDownload size={32} className="text-cyan-500 mb-2" />
            <span className="text-sm">Cloud Download</span>
          </div>
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <AiOutlineCloudUpload size={32} className="text-pink-500 mb-2" />
            <span className="text-sm">Cloud Upload</span>
          </div>
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <AiOutlineFile size={32} className="text-gray-500 mb-2" />
            <span className="text-sm">File</span>
          </div>
        </div>
      </section>

      {/* Material Design Icons */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">Material Design Icons</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <MdDashboard size={32} className="text-teal-500 mb-2" />
            <span className="text-sm">Dashboard</span>
          </div>
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <MdNotifications size={32} className="text-amber-500 mb-2" />
            <span className="text-sm">Notifications</span>
          </div>
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <FaBell size={32} className="text-yellow-500 mb-2" />
            <span className="text-sm">Bell</span>
          </div>
          <div className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-100">
            <FaSearch size={32} className="text-slate-500 mb-2" />
            <span className="text-sm">Search</span>
          </div>
        </div>
      </section>

      {/* Icon Buttons */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Icon Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
            <FaDownload />
            Download
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
            <FaUpload />
            Upload
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition">
            <BiTransfer />
            Transfer
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
            <FaTimes />
            Close
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition">
            <FaCog />
            Settings
          </button>
        </div>
      </section>
    </div>
  );
}
