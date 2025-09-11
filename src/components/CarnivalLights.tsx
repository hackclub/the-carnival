import { useState, useEffect } from "react";

const bulbColors = ["#f43f5e", "#fb923c", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];

export default function CarnivalLights() {
	const [bulbCount, setBulbCount] = useState(12);

	useEffect(() => {
		const updateBulbCount = () => {
			setBulbCount(window.innerWidth < 768 ? 8 : 12);
		};
		
		updateBulbCount();
		window.addEventListener('resize', updateBulbCount);
		return () => window.removeEventListener('resize', updateBulbCount);
	}, []);

	return (
		<div className="pointer-events-none fixed inset-x-0 top-0 z-30 h-16 md:h-20 overflow-hidden">
			<div className="relative w-full h-full">
				<div className="absolute top-6 md:top-8 left-0 right-0 h-0.5 bg-gray-700 rounded-full" 
						 style={{
							clipPath: "polygon(0 50%, 15% 80%, 30% 20%, 45% 70%, 60% 30%, 75% 75%, 90% 25%, 100% 55%)"
						}} 
				/>
				
				<div className="absolute top-0 left-0 right-0 flex justify-evenly items-start pt-4 md:pt-6 px-4">
					{Array.from({ length: bulbCount }).map((_, i) => {
						const color = bulbColors[i % bulbColors.length];
						const duration = 2 + (i % 4) * 0.3;
						return (
							<div key={i} className="flex flex-col items-center">
								<div className="w-0.5 h-3 md:h-4 bg-gray-700 mb-1" />
								<div 
									className="w-3 h-4 md:w-4 md:h-5 rounded-full shadow-lg"
									style={{ 
										backgroundColor: color,
										boxShadow: `0 0 8px ${color}40, 0 0 16px ${color}20`,
										animation: `bulbPulse ${duration}s ease-in-out ${i * 0.1}s infinite`
									}}
								/>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}


