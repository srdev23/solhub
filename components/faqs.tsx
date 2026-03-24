import React from "react";
import { Accordion, AccordionItem } from "@nextui-org/react";

interface FaqItem {
    label: string;
    description: string;
}

interface FaqsProps {
    faqData: FaqItem[];
}

const Faqs: React.FC<FaqsProps> = ({ faqData = [] }) => {
    return (
        <>
            <h6 className="text-2xl pt-6 mb-3">Frequently Asked Questions</h6>
            {faqData.length > 0 && (
                <Accordion isCompact>
                    {faqData.map((item, index) => (
                        <AccordionItem key={index} aria-label={`${index}`} title={item.label}>
                            {item.description}
                        </AccordionItem>
                    ))}
                </Accordion>
            )}
        </>
    );
}

export default Faqs;
