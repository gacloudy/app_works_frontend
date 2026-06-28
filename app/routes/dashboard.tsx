export function meta() {
  return [{ title: "ダッシュボード | 株価分析" }];
}

export default function Dashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
        ダッシュボード
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">登録銘柄数</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-1">--</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">最終取得日時</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-1">--</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">検出パターン数</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100 mt-1">--</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">
          注目銘柄
        </h3>
        <div className="text-gray-400 dark:text-gray-500 text-sm py-8 text-center">
          データがありません
        </div>
      </div>
    </div>
  );
}
