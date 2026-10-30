// // components/Charts/PieChartComponent.jsx
// import React from "react";
// import {
//   PieChart,
//   Pie,
//   Tooltip,
//   Legend,
//   ResponsiveContainer,
//   Cell,
// } from "recharts";
// import Card, { CardTitle } from "../Common/Card";
// import { useTheme } from "../Settings/themeUtils";

// const PieChartComponent = ({
//   title,
//   description,
//   data,
//   innerRadius = 60,
//   outerRadius = 110,
//   cx = "45%",
//   cy = "50%",
//   height = 350,
//   paddingAngle = 4,
//   label = (entry) => `${entry.name} (${entry.value})`,
//   icon,
//   iconBgGradient = "from-purple-50 to-purple-100",
// }) => {
//   const { themeUtils } = useTheme();

//   return (
//     <Card
//       bgColor={themeUtils.getBgColor("card")}
//       borderColor={themeUtils.getBorderColor()}
//       padding="p-0"
//       shadow="shadow-lg"
//       hover={true}
//       className="overflow-hidden"
//     >
//       {/* Chart Header */}
//       <div
//         className="p-4 pb-4 border-b"
//         style={{ borderColor: themeUtils.getBorderColor() }}
//       >
//         <div className="flex items-center gap-3">
//           <div className={`p-2 rounded-lg bg-gradient-to-br ${iconBgGradient}`}>
//             {icon || (
//               <svg
//                 className="w-4 h-5 text-purple-600"
//                 fill="none"
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth="2"
//                 viewBox="0 0 24 24"
//                 stroke="currentColor"
//               >
//                 <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path>
//                 <path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path>
//               </svg>
//             )}
//           </div>
//           <div>
//             <CardTitle className="text-lg mb-0">{title}</CardTitle>
//             <p
//               className="text-xs opacity-60 mt-0.5"
//               style={{
//                 color: themeUtils.getTextColor(false),
//               }}
//             >
//               {description}
//             </p>
//           </div>
//         </div>
//       </div>

//       {/* Chart Content */}
//       <div className="p-1">
//         <ResponsiveContainer width="100%" height={height}>
//           <PieChart>
//             <Pie
//               data={data}
//               cx={cx}
//               cy={cy}
//               innerRadius={innerRadius}
//               outerRadius={outerRadius}
//               paddingAngle={paddingAngle}
//               dataKey="value"
//               nameKey="name"
//               labelLine={true}
//               label={label}
//             >
//               {data.map((entry, index) => (
//                 <Cell key={`cell-${index}`} fill={entry.color} />
//               ))}
//             </Pie>
//             <Tooltip />
//             <Legend
//               verticalAlign="bottom"
//               height={36}
//               iconType="circle"
//               formatter={(value) => <span className="text-xs">{value}</span>}
//             />
//           </PieChart>
//         </ResponsiveContainer>
//       </div>
//     </Card>
//   );
// };

// export default PieChartComponent;

// components/Common/ChartComponent.jsx
import React from "react";
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  XAxis,
  YAxis,
} from "recharts";
import Card, { CardTitle } from "../common/Card.jsx";
import { useTheme } from "../Settings/themeUtils.jsx";

const ChartComponent = ({
  type = "pie", // "pie" or "bar"
  title,
  description,
  data,
  // Pie Chart Props
  innerRadius = 50,
  outerRadius = 90,
  cx = "45%",
  cy = "80%",
  paddingAngle = 4,
  label,
  // Bar Chart Props
  bars = [],
  barSize = 28,
  xAxisKey = "month",
  // Common Props
  height = 350,
  icon,
  iconBgGradient = "from-purple-50 to-purple-100",
}) => {
  const { themeUtils } = useTheme();

  return (
    <Card
      bgColor={themeUtils.getBgColor("card")}
      borderColor={themeUtils.getBorderColor()}
      padding="p-0"
      shadow="shadow-lg"
      hover={true}
      className="overflow-hidden"
    >
      {/* Chart Header */}
      <div
        className="p-2 pb-2"
        style={{ borderColor: themeUtils.getBorderColor() }}
      >
        <div className="flex items-center gap-3">
          <div className={`p-1 rounded-lg bg-gradient-to-br ${iconBgGradient}`}>
            {icon || (
              <svg
                className="w-4 h-4 text-purple-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {type === "pie" ? (
                  <>
                    <path d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path>
                    <path d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path>
                  </>
                ) : (
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                )}
              </svg>
            )}
          </div>
          <div>
            <CardTitle className="text-lg mb-0">{title}</CardTitle>
            <p
              className="text-xs opacity-60 mt-0.5"
              style={{
                color: themeUtils.getTextColor(false),
              }}
            >

            </p>
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className={type === "pie" ? "p-1" : "p-3 pb-0"}>
        <ResponsiveContainer width="100%" height={height}>
          {type === "pie" ? (
            <PieChart>
              <Pie
                data={data}
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                paddingAngle={paddingAngle}
                dataKey="value"
                nameKey="name"
                labelLine={true}
                label={label || ((entry) => `${entry.name} (${entry.value})`)}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend
                verticalAlign="bottom"
                height={40}
                iconType="circle"
                formatter={(value) => <span className="text-xs">{value}</span>}
              />
            </PieChart>
          ) : (
            <BarChart data={data} barSize={barSize}>
              <XAxis
                dataKey={xAxisKey}
                tick={{ fontSize: 12 }}
                axisLine={{ strokeWidth: 1 }}
              />
              <YAxis tick={{ fontSize: 12 }} axisLine={{ strokeWidth: 1 }} />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="circle" />
              {bars.map((bar, index) => (
                <Bar
                  key={index}
                  dataKey={bar.dataKey}
                  fill={bar.fill}
                  name={bar.name}
                  radius={[8, 8, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default ChartComponent;
